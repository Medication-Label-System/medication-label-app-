import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import { supabase } from "./supabaseClient";
import api from "./api";  // Add this line
import "./App.css";
import pharmacyLogo from "./assets/logo.png";

// Memoized Medication Item Component
const MedicationItem = memo(({ medication, patients, addToBasket, doesNotRequireExpiry, isGroup = false, onAddGroup }) => {
  const isNoExpiryRequired = doesNotRequireExpiry(medication.requires_expiry_date);

  return (
    <div className={`medication-item ${isNoExpiryRequired ? 'no-expiry-required' : ''} ${isGroup ? 'group-item' : ''}`}>
      <div className="medication-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isGroup ? (
            <span style={{ 
              backgroundColor: '#4a6fa5', 
              color: 'white',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: 'bold'
            }}>
              📋 GROUP
            </span>
          ) : null}
          <strong>{medication.DrugName}</strong>
        </div>
        
        {!isGroup && <p>{medication.Instruction}</p>}
        
        {isGroup ? (
          <div style={{ marginTop: '5px' }}>
            <small style={{ color: '#4a6fa5', fontWeight: 'bold' }}>
              {medication.drugCount || 0} medications in this protocol
            </small>
            {medication.description && (
              <p style={{ fontSize: '12px', color: '#666', marginTop: '3px' }}>
                {medication.description}
              </p>
            )}
          </div>
        ) : (
          <>
            {medication.active_ingredient && (
              <small style={{ color: "#666", fontStyle: "italic" }}>
                المادة الفعالة: {medication.active_ingredient}
              </small>
            )}
            {medication.InternationalCode && (
              <small>Barcode: {medication.InternationalCode}</small>
            )}
            {isNoExpiryRequired && (
              <small style={{ color: "#6c757d", fontStyle: "italic", display: "block", marginTop: "5px" }}>
                📝 No expiry date required on label
              </small>
            )}
          </>
        )}
      </div>
      
      {isGroup ? (
        <button
          onClick={() => onAddGroup(medication)}
          disabled={!patients}
          style={{
            backgroundColor: '#4a6fa5',
            borderColor: '#4a6fa5'
          }}
        >
          Add Group to Basket
        </button>
      ) : (
        <button
          onClick={() => addToBasket(medication)}
          disabled={!patients}
        >
          Add to Basket
        </button>
      )}
    </div>
  );
});

// Memoized Basket Item Component
const BasketItem = memo(({ 
  item, 
  updateMedicationQuantity, 
  handleExpiryMonthChange, 
  handleExpiryYearChange, 
  removeFromBasket,
  requiresExpiry,
  months,
  years
}) => {
  const requiresExpiryDate = requiresExpiry(item.requiresExpiryDate);

  return (
    <div key={item.TempID} className={`basket-item ${!requiresExpiryDate ? 'no-expiry-required' : ''}`}>
      <div className="basket-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <strong>{item.DrugName}</strong>
          {item.fromGroup && (
            <span style={{
              fontSize: '10px',
              backgroundColor: '#e8f4fd',
              color: '#4a6fa5',
              padding: '2px 6px',
              borderRadius: '10px',
              fontWeight: 'bold'
            }}>
              From: {item.fromGroup}
            </span>
          )}
        </div>
        <p>{item.InstructionText}</p>

        {/* Quantity Selector */}
        <div className="quantity-input">
          <label>Number of Labels:</label>
          <input
            type="number"
            min="1"
            max="10"
            value={item.printQuantity || 1}
            onChange={(e) => updateMedicationQuantity(item.TempID, e.target.value)}
            style={{
              width: "60px",
              marginLeft: "10px",
              padding: "5px",
            }}
          />
        </div>

        {/* Expiry Date Selector - Only show if medication requires expiry date */}
        {requiresExpiryDate ? ( 
          <div className="expiry-input">
            <label>Expiry Date:</label>
            <div
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "center",
                marginTop: "5px",
              }}
            >
              <select
                value={item.expiryMonth || ""}
                onChange={(e) => handleExpiryMonthChange(item.TempID, e.target.value)}
                style={{ padding: "5px", minWidth: "100px" }}
              >
                <option value="">Select Month</option>
                {months.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>

              <select
                value={item.expiryYear || ""}
                onChange={(e) => handleExpiryYearChange(item.TempID, e.target.value)}
                style={{ padding: "5px", minWidth: "80px" }}
              >
                <option value="">Select Year</option>
                {years.map((year) => (
                  <option key={year.value} value={year.value}>
                    {year.label}
                  </option>
                ))}
              </select>

              {item.expiryDate && (
                <span
                  style={{
                    fontSize: "0.8em",
                    color: "green",
                    fontWeight: "bold",
                  }}
                >
                  ✓ {item.expiryDate}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="expiry-info" style={{ marginTop: "10px", padding: "5px", backgroundColor: "#f0f0f0", borderRadius: "5px" }}>
            <small style={{ color: "#666", fontStyle: "italic" }}>
              📝 No expiry date required - Will show "Specified On The Item's Container"
            </small>
          </div>
        )}
      </div>
      <button
        onClick={() => removeFromBasket(item.TempID)}
        className="remove-btn"
      >
        ❌
      </button>
    </div>
  );
});

function App() {
  const [user, setUser] = useState(null);
  const [medications, setMedications] = useState([]);
  const [basket, setBasket] = useState([]);
  const [patients, setPatients] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [customInstruction, setCustomInstruction] = useState("");
  const [useCustomInstruction, setUseCustomInstruction] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState("medications");

  // Custom Drug State
  const [showCustomDrugModal, setShowCustomDrugModal] = useState(false);
  const [customDrugData, setCustomDrugData] = useState({
    drugName: '',
    instructionText: '',
    activeIngredient: '',
    internationalCode: '',
    requiresExpiryDate: true
  });
  const [addingToBasket, setAddingToBasket] = useState(false);

  // Patient Management State
  const [showPatientManagement, setShowPatientManagement] = useState(false);
  const [patientsList, setPatientsList] = useState([]);
  const [showAddPatientModal, setShowAddPatientModal] = useState(false);
  const [newPatientData, setNewPatientData] = useState({
    patientId: '',
    year: new Date().getFullYear().toString().slice(-2),
    patientName: '',
    nationalId: ''
  });
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [patientsPagination, setPatientsPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0
  });
  const [editingPatient, setEditingPatient] = useState(null);

  // Admin Management State
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserData, setNewUserData] = useState({
    username: '',
    password: '',
    fullName: '',
    accessLevel: 'user',
    isActive: true
  });
  const [editingUser, setEditingUser] = useState(null);
  const [adminStatistics, setAdminStatistics] = useState({});
  const [recentActivities, setRecentActivities] = useState([]);
  const [adminActiveTab, setAdminActiveTab] = useState('dashboard');

  // Medication Groups State (NEW FEATURE)
  const [medicationGroups, setMedicationGroups] = useState([]);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [newGroupData, setNewGroupData] = useState({
    groupName: '',
    description: '',
    drugs: []
  });
  const [editingGroup, setEditingGroup] = useState(null);
  const [showGroupDetailsModal, setShowGroupDetailsModal] = useState(false);
  const [selectedGroupDetails, setSelectedGroupDetails] = useState(null);
  const [availableDrugsForGroup, setAvailableDrugsForGroup] = useState([]);
  const [groupSearchTerm, setGroupSearchTerm] = useState('');

  // Generate months (01-12) and years (26-50) - Memoized
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    value: (i + 1).toString().padStart(2, "0"),
    label: `${(i + 1).toString().padStart(2, "0")} - ${new Date(2000, i).toLocaleString("en", { month: "long" })}`,
  })), []);

  const years = useMemo(() => Array.from({ length: 25 }, (_, i) => ({
    value: (i + 26).toString(),
    label: `20${(i + 26).toString()}`,
  })), []);

  // ==================== MEMOIZED HELPER FUNCTIONS ====================
  const requiresExpiry = useCallback((value) => {
    if (value === false || value === 0 || value === "0" || value === "false") return false;
    if (value === true || value === 1 || value === "1" || value === "true") return true;
    return true;
  }, []);

  const doesNotRequireExpiry = useCallback((value) => {
    return !requiresExpiry(value);
  }, [requiresExpiry]);

  const createUniqueKey = useCallback((medication, index) => {
    return `${medication.DrugName}-${index}-${medication.InternationalCode || ""}`;
  }, []);

  // ==================== ACCESS CONTROL VARIABLES ====================
  const canManagePatients = true;
  const canManageDrugs = isAdmin || user?.accessLevel === 'manager';
  const canAccessAdminPanel = isAdmin;
  const canManageMedicationGroups = isAdmin; // Only admin can create/manage groups

  // ==================== MEMOIZED COMPUTATIONS ====================
  const filteredMedications = useMemo(() => {
    if (!searchTerm.trim()) return medications;

    const searchText = searchTerm.trim().toLowerCase();

    return medications.filter((medication) => {
      const drugName = (medication.DrugName || "").toLowerCase();
      const instruction = (medication.Instruction || "").toLowerCase();
      const activeIngredient = (medication.active_ingredient || "").toLowerCase();

      return drugName.includes(searchText) || 
             instruction.includes(searchText) || 
             activeIngredient.includes(searchText);
    });
  }, [medications, searchTerm]);

  // Combined search results: medications + groups
  const combinedSearchResults = useMemo(() => {
    const medResults = filteredMedications;
    const groupResults = medicationGroups.filter(group => 
      group.groupName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (group.description && group.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Convert groups to medication-like objects for display
    const formattedGroups = groupResults.map(group => ({
      ...group,
      DrugName: group.groupName,
      Instruction: group.description || `Medication protocol with ${group.drugCount || 0} drugs`,
      isGroup: true
    }));

    return [...formattedGroups, ...medResults];
  }, [filteredMedications, medicationGroups, searchTerm]);

  const totalLabelsCount = useMemo(() => {
    return basket.reduce((total, item) => total + (item.printQuantity || 1), 0);
  }, [basket]);

  const medicationsRequiringExpiry = useMemo(() => {
    return basket.filter(item => requiresExpiry(item.requiresExpiryDate));
  }, [basket, requiresExpiry]);

  const medicationsMissingRequiredExpiry = useMemo(() => {
    return basket.filter(item => requiresExpiry(item.requiresExpiryDate) && !item.expiryDate);
  }, [basket, requiresExpiry]);

  // ==================== MEDICATION GROUPS FUNCTIONS (NEW) ====================
  const loadMedicationGroups = useCallback(async () => {
    try {
      const groups = await api.medicationGroups.getAll();
      setMedicationGroups(groups || []);
    } catch (error) {
      console.error("❌ Error loading medication groups:", error);
      setMedicationGroups([]);
    }
  }, []);

  const loadAvailableDrugsForGroup = useCallback(async () => {
    try {
      const drugs = await api.medications.getAll();
      setAvailableDrugsForGroup(drugs || []);
    } catch (error) {
      console.error("Error loading drugs for group:", error);
      setAvailableDrugsForGroup([]);
    }
  }, []);

  const openGroupManager = async () => {
    setShowGroupManager(true);
    await loadMedicationGroups();
    await loadAvailableDrugsForGroup();
  };

  const closeGroupManager = () => {
    setShowGroupManager(false);
    setEditingGroup(null);
    setGroupSearchTerm('');
  };

  const openAddGroupModal = () => {
    setNewGroupData({
      groupName: '',
      description: '',
      drugs: []
    });
    setEditingGroup(null);
    setShowAddGroupModal(true);
  };

  const closeAddGroupModal = () => {
    setShowAddGroupModal(false);
    setEditingGroup(null);
  };

  const handleGroupInputChange = (field, value) => {
    if (editingGroup) {
      setEditingGroup(prev => ({
        ...prev,
        [field]: value
      }));
    } else {
      setNewGroupData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const addDrugToGroup = (drug) => {
    if (editingGroup) {
      // Check if drug already exists in group
      if (!editingGroup.drugs.some(d => d.DrugID === drug.DrugID)) {
        setEditingGroup(prev => ({
          ...prev,
          drugs: [...prev.drugs, {
            ...drug,
            defaultQuantity: 1,
            requires_expiry_date: drug.requires_expiry_date
          }]
        }));
      }
    } else {
      if (!newGroupData.drugs.some(d => d.DrugID === drug.DrugID)) {
        setNewGroupData(prev => ({
          ...prev,
          drugs: [...prev.drugs, {
            ...drug,
            defaultQuantity: 1,
            requires_expiry_date: drug.requires_expiry_date
          }]
        }));
      }
    }
  };

  const removeDrugFromGroup = (drugId) => {
    if (editingGroup) {
      setEditingGroup(prev => ({
        ...prev,
        drugs: prev.drugs.filter(d => d.DrugID !== drugId)
      }));
    } else {
      setNewGroupData(prev => ({
        ...prev,
        drugs: prev.drugs.filter(d => d.DrugID !== drugId)
      }));
    }
  };

  const updateDrugQuantityInGroup = (drugId, quantity) => {
    const newQuantity = Math.max(1, Math.min(10, parseInt(quantity) || 1));
    
    if (editingGroup) {
      setEditingGroup(prev => ({
        ...prev,
        drugs: prev.drugs.map(d => 
          d.DrugID === drugId ? { ...d, defaultQuantity: newQuantity } : d
        )
      }));
    } else {
      setNewGroupData(prev => ({
        ...prev,
        drugs: prev.drugs.map(d => 
          d.DrugID === drugId ? { ...d, defaultQuantity: newQuantity } : d
        )
      }));
    }
  };

  const saveMedicationGroup = async () => {
    if (!newGroupData.groupName.trim()) {
      alert('Please enter a group name');
      return;
    }

    if (newGroupData.drugs.length === 0) {
      alert('Please add at least one medication to the group');
      return;
    }

    try {
      const result = await api.medicationGroups.create(
        newGroupData.groupName,
        newGroupData.description || '',
        newGroupData.drugs.map(drug => ({
          drugId: drug.DrugID,
          defaultQuantity: drug.defaultQuantity || 1
        }))
      );

      if (!result.success) {
        alert(result.message || 'Error saving medication group');
        return;
      }

      alert('Medication group saved successfully!');
      closeAddGroupModal();
      loadMedicationGroups();
    } catch (error) {
      console.error('Error saving medication group:', error);
      alert('Error saving medication group: ' + error.message);
    }
  };

  const updateMedicationGroup = async () => {
    if (!editingGroup.groupName.trim()) {
      alert('Please enter a group name');
      return;
    }

    if (editingGroup.drugs.length === 0) {
      alert('Please add at least one medication to the group');
      return;
    }

    try {
      const result = await api.medicationGroups.update(
        editingGroup.groupId,
        editingGroup.groupName,
        editingGroup.description || '',
        editingGroup.drugs.map(drug => ({
          drugId: drug.DrugID,
          defaultQuantity: drug.defaultQuantity || 1
        }))
      );

      if (!result.success) {
        alert(result.message || 'Error updating medication group');
        return;
      }

      alert('Medication group updated successfully!');
      closeAddGroupModal();
      loadMedicationGroups();
    } catch (error) {
      console.error('Error updating medication group:', error);
      alert('Error updating medication group: ' + error.message);
    }
  };

  const deleteMedicationGroup = async (group) => {
    if (!window.confirm(`Are you sure you want to delete group: "${group.groupName}"?\n\nThis will not delete the individual medications, only the group template.`)) {
      return;
    }

    try {
      const result = await api.medicationGroups.delete(group.groupId);

      if (!result.success) {
        alert(result.message || 'Error deleting group');
        return;
      }

      alert('Group deleted successfully!');
      loadMedicationGroups();
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('Error deleting group: ' + error.message);
    }
  };

  const viewGroupDetails = async (group) => {
    try {
      const details = await api.medicationGroups.getDetails(group.groupId);
      setSelectedGroupDetails(details);
      setShowGroupDetailsModal(true);
    } catch (error) {
      console.error('Error loading group details:', error);
      alert('Error loading group details: ' + error.message);
    }
  };

  const addGroupToBasket = async (group) => {
    if (!patients) {
      alert("Please search and select a patient first!");
      return;
    }

    try {
      const groupDetails = await api.medicationGroups.getDetails(group.groupId);
      
      if (!groupDetails || !groupDetails.drugs || groupDetails.drugs.length === 0) {
        alert('This group contains no medications');
        return;
      }

      const newItems = groupDetails.drugs.map(drug => {
        const requiresExpiryDate = requiresExpiry(drug.requires_expiry_date);
        
        return {
          TempID: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          DrugName: drug.DrugName,
          InstructionText: drug.Instruction || 'Take as directed',
          printQuantity: drug.defaultQuantity || 1,
          expiryDate: "",
          expiryMonth: "",
          expiryYear: "",
          requiresExpiryDate: requiresExpiryDate,
          fromGroup: group.groupName
        };
      });

      const updatedBasket = [...basket, ...newItems];
      setBasket(updatedBasket);
      localStorage.setItem('medicationBasket', JSON.stringify(updatedBasket));

      alert(`Added "${group.groupName}" group to basket (${newItems.length} medications)`);
      
      // Close details modal if open
      if (showGroupDetailsModal) {
        setShowGroupDetailsModal(false);
      }
    } catch (error) {
      console.error('Error adding group to basket:', error);
      alert('Error adding group to basket: ' + error.message);
    }
  };

  const editMedicationGroup = (group) => {
    setEditingGroup({ ...group });
    setShowAddGroupModal(true);
  };

  // ==================== MEDICATIONS ====================
  const loadMedications = useCallback(async () => {
    try {
      console.log("🔄 Loading medications from API...");
      const medications = await api.medications.getAll();

      const noExpiryCount = medications.filter(m => 
        doesNotRequireExpiry(m.requires_expiry_date)
      ).length;

      console.log(`📊 ${noExpiryCount} medications don't require expiry dates`);

      setMedications(medications || []);
    } catch (error) {
      console.error("❌ Error loading medications:", error);
      setMedications([]);
    }
  }, [doesNotRequireExpiry]);

  // Load medications on startup
  useEffect(() => {
    loadMedications();
    loadLocalAuditLogs();
    loadBasket();
    loadMedicationGroups(); // Load groups on startup
  }, [loadMedications, loadMedicationGroups]);

  // ==================== BASKET MANAGEMENT ====================
  const loadBasket = useCallback(() => {
    try {
      const savedBasket = localStorage.getItem('medicationBasket');
      if (savedBasket) {
        const basketData = JSON.parse(savedBasket);
        setBasket(basketData);
      }
    } catch (error) {
      console.error("Error loading basket:", error);
      setBasket([]);
    }
  }, []);

  const addToBasket = useCallback((medication) => {
    if (!patients) {
      alert("Please search and select a patient first!");
      return;
    }

    const instructionToUse = useCustomInstruction && customInstruction 
      ? customInstruction 
      : medication.Instruction;

    let requiresExpiryDate = true;

    if (
      medication.requires_expiry_date === false ||
      medication.requires_expiry_date === 0 ||
      medication.requires_expiry_date === "0" ||
      medication.requires_expiry_date === "false"
    ) {
      requiresExpiryDate = false;
    }
    else if (
      medication.requires_expiry_date === true ||
      medication.requires_expiry_date === 1 ||
      medication.requires_expiry_date === "1" ||
      medication.requires_expiry_date === "true"
    ) {
      requiresExpiryDate = true;
    }

    const newItem = {
      TempID: Date.now().toString(),
      DrugName: medication.DrugName,
      InstructionText: instructionToUse,
      printQuantity: 1,
      expiryDate: "",
      expiryMonth: "",
      expiryYear: "",
      requiresExpiryDate: requiresExpiryDate
    };

    const updatedBasket = [...basket, newItem];
    setBasket(updatedBasket);
    localStorage.setItem('medicationBasket', JSON.stringify(updatedBasket));

    if (useCustomInstruction) {
      setCustomInstruction("");
      setUseCustomInstruction(false);
    }

    alert(`Added ${medication.DrugName} to basket`);
  }, [patients, useCustomInstruction, customInstruction, basket]);

  const updateMedicationQuantity = useCallback((tempId, quantity) => {
    const newQuantity = Math.max(1, Math.min(10, parseInt(quantity) || 1));

    setBasket((prevBasket) =>
      prevBasket.map((item) =>
        item.TempID === tempId
          ? { ...item, printQuantity: newQuantity }
          : item,
      ),
    );

    const updatedBasket = basket.map(item => 
      item.TempID === tempId ? { ...item, printQuantity: newQuantity } : item
    );
    localStorage.setItem('medicationBasket', JSON.stringify(updatedBasket));
  }, [basket]);

  const handleExpiryMonthChange = useCallback((tempId, month) => {
    setBasket((prevBasket) =>
      prevBasket.map((item) => {
        if (item.TempID === tempId) {
          const newExpiryDate =
            month && item.expiryYear ? `${month}/${item.expiryYear}` : "";
          return {
            ...item,
            expiryMonth: month,
            expiryDate: newExpiryDate,
          };
        }
        return item;
      }),
    );
  }, []);

  const handleExpiryYearChange = useCallback((tempId, year) => {
    setBasket((prevBasket) =>
      prevBasket.map((item) => {
        if (item.TempID === tempId) {
          const newExpiryDate =
            item.expiryMonth && year ? `${item.expiryMonth}/${year}` : "";
          return {
            ...item,
            expiryYear: year,
            expiryDate: newExpiryDate,
          };
        }
        return item;
      }),
    );
  }, []);

  const removeFromBasket = useCallback((tempId) => {
    const updatedBasket = basket.filter(item => item.TempID !== tempId);
    setBasket(updatedBasket);
    localStorage.setItem('medicationBasket', JSON.stringify(updatedBasket));
  }, [basket]);

  const clearBasket = useCallback(() => {
    if (basket.length === 0) {
      alert("Basket is already empty");
      return;
    }

    if (
      window.confirm(
        "Are you sure you want to clear ALL medications from the basket?\n\nThis will remove all items and their settings (quantity, expiry dates)."
      )
    ) {
      setBasket([]);
      localStorage.removeItem('medicationBasket');
      alert("Basket cleared successfully");
    }
  }, [basket.length]);

  const copyBasket = () => {
    if (basket.length === 0) {
      alert("Basket is empty");
      return;
    }
    
    const copiedBasket = basket.map(item => ({
      ...item,
      TempID: Date.now().toString() + Math.random().toString(36).substr(2, 9)
    }));
    
    setBasket(copiedBasket);
    localStorage.setItem('medicationBasket', JSON.stringify(copiedBasket));
    alert(`Created a copy of ${basket.length} basket items. You can now modify them independently.`);
  };

  const resetExpiryDates = () => {
    if (basket.length === 0) {
      alert("Basket is empty");
      return;
    }
    
    if (window.confirm("Reset all expiry dates in the basket? This will clear month/year selections for all items.")) {
      const updatedBasket = basket.map(item => ({
        ...item,
        expiryDate: "",
        expiryMonth: "",
        expiryYear: ""
      }));
      
      setBasket(updatedBasket);
      localStorage.setItem('medicationBasket', JSON.stringify(updatedBasket));
      alert("All expiry dates have been reset");
    }
  };

  // ==================== PATIENT MANAGEMENT ====================
  const searchPatient = async (patientId, year) => {
    if (!patientId || !year) {
      alert("Please enter both Patient ID and Year");
      return;
    }

    try {
      const result = await api.patients.search(patientId, year);

      if (!result.success || !result.patient) {
        alert(result.message || "Patient not found");
        setPatients(null);
        return;
      }

      setPatients({
        ...result.patient,
        fullId: result.fullId || `${result.patient.PatientID}/${result.patient.Year}`
      });

    } catch (error) {
      alert("Error searching patient: " + error.message);
      setPatients(null);
    }
  };

  const resetPatient = () => {
    if (!patients) {
      alert("No patient is currently selected");
      return;
    }
    
    if (window.confirm(`Clear current patient (${patients.PatientName}) but keep basket items for next patient?`)) {
      setPatients(null);
      alert("Patient cleared. Basket items preserved. Search for a new patient.");
    }
  };

  const loadPatientsList = async (page = 1, search = '') => {
    try {
      const result = await api.patients.getAll(page, 20, search);

      setPatientsList(result.patients || []);
      setPatientsPagination({
        page: result.page || page,
        totalPages: result.totalPages || 1,
        total: result.total || 0
      });

    } catch (error) {
      console.error("Error loading patients:", error);
      setPatientsList([]);
    }
  };

  const openPatientManagement = () => {
    setShowPatientManagement(true);
    loadPatientsList();
    setActiveTab("medications");
  };

  const closePatientManagement = () => {
    setShowPatientManagement(false);
    setPatientSearchTerm('');
    setEditingPatient(null);
  };

  const openAddPatientModal = () => {
    setNewPatientData({
      patientId: '',
      year: new Date().getFullYear().toString().slice(-2),
      patientName: '',
      nationalId: ''
    });
    setEditingPatient(null);
    setShowAddPatientModal(true);
  };

  const closeAddPatientModal = () => {
    setShowAddPatientModal(false);
    setEditingPatient(null);
  };

  const handlePatientInputChange = (field, value) => {
    if (editingPatient) {
      setEditingPatient(prev => ({
        ...prev,
        [field]: value
      }));
    } else {
      setNewPatientData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const addNewPatient = async () => {
    if (!newPatientData.patientId || !newPatientData.year || !newPatientData.patientName) {
      alert('Please fill in all required fields (Patient ID, Year, and Patient Name)');
      return;
    }

    try {
      const result = await api.patients.add(
        newPatientData.patientId,
        newPatientData.year,
        newPatientData.patientName,
        newPatientData.nationalId || null
      );

      if (!result.success) {
        alert(result.message || 'Error adding patient');
        return;
      }

      alert('Patient added successfully!');
      closeAddPatientModal();
      loadPatientsList();

      setPatients({
        PatientID: newPatientData.patientId,
        Year: newPatientData.year,
        PatientName: newPatientData.patientName,
        NationalID: newPatientData.nationalId,
        fullId: `${newPatientData.patientId}/${newPatientData.year}`
      });
    } catch (error) {
      console.error('Error adding patient:', error);
      alert('Error adding patient: ' + error.message);
    }
  };

  const editPatient = (patient) => {
    setEditingPatient({ ...patient });
    setShowAddPatientModal(true);
  };

  const updatePatient = async () => {
    if (!editingPatient.PatientName) {
      alert('Patient Name is required');
      return;
    }

    try {
      const result = await api.patients.update(
        editingPatient.PatientID,
        editingPatient.Year,
        editingPatient.PatientName,
        editingPatient.NationalID
      );

      if (!result.success) {
        alert(result.message || 'Error updating patient');
        return;
      }

      alert('Patient updated successfully!');
      closeAddPatientModal();
      loadPatientsList();

      if (patients && patients.PatientID === editingPatient.PatientID && patients.Year === editingPatient.Year) {
        setPatients(prev => ({
          ...prev,
          PatientName: editingPatient.PatientName,
          NationalID: editingPatient.NationalID
        }));
      }
    } catch (error) {
      console.error('Error updating patient:', error);
      alert('Error updating patient: ' + error.message);
    }
  };

  const deletePatient = async (patient) => {
    if (!window.confirm(`Are you sure you want to delete patient: ${patient.PatientName} (ID: ${patient.PatientID}/${patient.Year})?`)) {
      return;
    }

    try {
      const result = await api.patients.delete(patient.PatientID, patient.Year);

      if (!result.success) {
        alert(result.message || 'Error deleting patient');
        return;
      }

      alert('Patient deleted successfully!');
      loadPatientsList();

      if (patients && patients.PatientID === patient.PatientID && patients.Year === patient.Year) {
        setPatients(null);
      }
    } catch (error) {
      console.error('Error deleting patient:', error);
      alert('Error deleting patient: ' + error.message);
    }
  };

  const selectPatientFromList = (patient) => {
    setPatients({
      ...patient,
      fullId: `${patient.PatientID}/${patient.Year}`
    });
    closePatientManagement();
    alert(`Patient selected: ${patient.PatientName}`);
  };

  const handlePatientSearch = (e) => {
    e.preventDefault();
    loadPatientsList(1, patientSearchTerm);
  };

  const clearPatientSearch = () => {
    setPatientSearchTerm('');
    loadPatientsList(1, '');
  };

  const handleQuickPatientSearch = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const patientId = formData.get("patientId");
    const year = formData.get("year");
    searchPatient(patientId, year);
  };

  // ==================== CUSTOM DRUG MANAGEMENT ====================
  const handleCustomDrugInputChange = useCallback((field, value) => {
    setCustomDrugData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const openCustomDrugModal = () => {
    setCustomDrugData({
      drugName: '',
      instructionText: '',
      activeIngredient: '',
      internationalCode: '',
      requiresExpiryDate: true
    });
    setShowCustomDrugModal(true);
    setAddingToBasket(false);
  };

  const openQuickAddModal = () => {
    setCustomDrugData({
      drugName: '',
      instructionText: '',
      activeIngredient: '',
      internationalCode: '',
      requiresExpiryDate: true
    });
    setShowCustomDrugModal(true);
    setAddingToBasket(true);
  };

  const closeCustomDrugModal = () => {
    setShowCustomDrugModal(false);
    setCustomDrugData({
      drugName: '',
      instructionText: '',
      activeIngredient: '',
      internationalCode: '',
      requiresExpiryDate: true
    });
  };

  const saveCustomDrug = async () => {
    if (!customDrugData.drugName.trim()) {
      alert('Please enter a drug name');
      return;
    }

    if (!patients) {
      alert('Please search and select a patient first!');
      return;
    }

    try {
      const expiryRequired = customDrugData.requiresExpiryDate;
      
      console.log("💾 Saving custom drug:", {
        name: customDrugData.drugName,
        requiresExpiryDate: expiryRequired,
        checkboxValue: customDrugData.requiresExpiryDate,
        type: typeof customDrugData.requiresExpiryDate
      });

      const result = await api.medications.addCustom(
        customDrugData.drugName,
        customDrugData.instructionText || 'Take as directed',
        customDrugData.activeIngredient || '',
        customDrugData.internationalCode || '',
        expiryRequired
      );

      if (!result.success) {
        alert(result.message || 'Error saving custom drug');
        return;
      }

      const newItem = {
        TempID: Date.now().toString(),
        DrugName: customDrugData.drugName,
        InstructionText: customDrugData.instructionText || 'Take as directed',
        printQuantity: 1,
        expiryDate: "",
        expiryMonth: "",
        expiryYear: "",
        requiresExpiryDate: expiryRequired
      };

      const updatedBasket = [...basket, newItem];
      setBasket(updatedBasket);
      localStorage.setItem('medicationBasket', JSON.stringify(updatedBasket));

      await loadMedications();
      closeCustomDrugModal();

      alert('Custom drug added successfully!');
    } catch (error) {
      console.error('❌ Error saving custom drug:', error);
      alert('Error saving custom drug: ' + (error.message || 'Unknown error'));
    }
  };

  const quickAddCustomDrug = async () => {
    if (!customDrugData.drugName.trim()) {
      alert('Please enter a drug name');
      return;
    }

    if (!patients) {
      alert('Please search and select a patient first!');
      return;
    }

    try {
      const expiryRequired = customDrugData.requiresExpiryDate;
      
      console.log("➕ Quick adding custom drug:", {
        name: customDrugData.drugName,
        requiresExpiryDate: expiryRequired
      });

      const newItem = {
        TempID: Date.now().toString(),
        DrugName: customDrugData.drugName,
        InstructionText: customDrugData.instructionText || 'Take as directed',
        printQuantity: 1,
        expiryDate: "",
        expiryMonth: "",
        expiryYear: "",
        requiresExpiryDate: expiryRequired
      };

      const updatedBasket = [...basket, newItem];
      setBasket(updatedBasket);
      localStorage.setItem('medicationBasket', JSON.stringify(updatedBasket));
      
      closeCustomDrugModal();
      alert(`Added "${customDrugData.drugName}" to basket successfully!`);
    } catch (error) {
      console.error('Error adding custom drug to basket:', error);
      alert('Error adding custom drug to basket: ' + error.message);
    }
  };

  // ==================== AUTHENTICATION ====================
  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const result = await api.auth.login(loginData.username, loginData.password);

      if (!result.success) {
        alert(result.message || 'Invalid username or password');
        return;
      }

      const user = result.user;
      setUser({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        accessLevel: user.accessLevel
      });

      if (user.username === "mahmoud_abdelkader" && loginData.password === "12345") {
        setIsAdmin(true);
        alert(`👑 Welcome System Administrator ${user.fullName}! Admin privileges activated.`);
      } else {
        alert(`✅ Welcome ${user.fullName}!`);
      }

    } catch (error) {
      alert('Login error: ' + error.message);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setPatients(null);
    setBasket([]);
    setLoginData({ username: "", password: "" });
    setActiveTab("medications");
    setIsAdmin(false);
  };

  // ==================== ADMIN MANAGEMENT ====================
  const openAdminPanel = async () => {
    setShowAdminPanel(true);
    loadAdminUsers();
    loadAdminStatistics();
    loadRecentActivities();
  };

  const closeAdminPanel = () => {
    setShowAdminPanel(false);
    setAdminActiveTab('dashboard');
  };

  const loadAdminUsers = async () => {
    try {
      const users = await api.admin.getUsers();
      setAdminUsers(users || []);
    } catch (error) {
      console.error('Error loading users:', error);
      alert('Error loading users: ' + error.message);
    }
  };

  const loadAdminStatistics = async () => {
    try {
      const stats = await api.admin.getStatistics();

      const auditLogs = JSON.parse(localStorage.getItem("medicationAuditLogs") || "[]");
      const auditLogsCount = auditLogs.length;

      setAdminStatistics({
        medicationsCount: stats.medicationsCount || 0,
        patientsCount: stats.patientsCount || 0,
        usersCount: stats.usersCount || 0,
        auditLogsCount,
        medicationGroupsCount: medicationGroups.length
      });
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const loadRecentActivities = async () => {
    try {
      const auditLogs = JSON.parse(localStorage.getItem("medicationAuditLogs") || "[]");
      const recent = auditLogs.slice(-20).reverse();
      setRecentActivities(recent);
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  const openAddUserModal = () => {
    setNewUserData({
      username: '',
      password: '',
      fullName: '',
      accessLevel: 'user',
      isActive: true
    });
    setEditingUser(null);
    setShowAddUserModal(true);
  };

  const closeAddUserModal = () => {
    setShowAddUserModal(false);
    setEditingUser(null);
  };

  const handleUserInputChange = (field, value) => {
    if (editingUser) {
      setEditingUser(prev => ({
        ...prev,
        [field]: value
      }));
    } else {
      setNewUserData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const addNewUser = async () => {
    if (!newUserData.username || !newUserData.password || !newUserData.fullName) {
      alert('Please fill in all required fields (Username, Password, and Full Name)');
      return;
    }

    try {
      const result = await api.admin.addUser(
        newUserData.username,
        newUserData.password,
        newUserData.fullName,
        newUserData.accessLevel,
        newUserData.isActive
      );

      if (!result.success) {
        alert(result.message || 'Error adding user');
        return;
      }

      alert('User added successfully!');
      closeAddUserModal();
      loadAdminUsers();
    } catch (error) {
      console.error('Error adding user:', error);
      alert('Error adding user: ' + error.message);
    }
  };

  const editUser = (user) => {
    setEditingUser({ ...user });
    setShowAddUserModal(true);
  };

  const updateUser = async () => {
    if (!editingUser.UserName || !editingUser.FullName) {
      alert('Username and Full Name are required');
      return;
    }

    try {
      const result = await api.admin.updateUser(
        editingUser.UserID,
        editingUser.UserName,
        editingUser.FullName,
        editingUser.AccessLevel,
        editingUser.IsActive,
        editingUser.Password || undefined
      );

      if (!result.success) {
        alert(result.message || 'Error updating user');
        return;
      }

      alert('User updated successfully!');
      closeAddUserModal();
      loadAdminUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Error updating user: ' + error.message);
    }
  };

  const deleteUser = async (user) => {
    if (!window.confirm(`Are you sure you want to delete user: ${user.FullName} (${user.UserName})?`)) {
      return;
    }

    try {
      const result = await api.admin.deleteUser(user.UserID);

      if (!result.success) {
        alert(result.message || 'Error deleting user');
        return;
      }

      alert('User deleted successfully!');
      loadAdminUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error deleting user: ' + error.message);
    }
  };

  // ==================== PRINTING & AUDIT ====================
  const getLogoForPrint = () => {
    return pharmacyLogo;
  };

  const saveToLocalAudit = async () => {
    try {
      const timestamp = new Date().toISOString();
      const printSessionId = Date.now().toString();

      const localAuditEntries = basket.map((item, index) => ({
        id: `${printSessionId}-${index}`,
        timestamp,
        printSessionId,
        patientId: patients.PatientID,
        patientYear: patients.Year,
        patientName: patients.PatientName,
        drugName: item.DrugName,
        instructionText: item.InstructionText,
        printedBy: user.fullName,
        expiryDate: item.expiryDate,
        requiresExpiryDate: item.requiresExpiryDate,
        printQuantity: item.printQuantity || 1,
        status: "printed",
        basketPreserved: true,
        fromGroup: item.fromGroup || null
      }));

      const existingLogs = JSON.parse(
        localStorage.getItem("medicationAuditLogs") || "[]",
      );
      const updatedLogs = [...existingLogs, ...localAuditEntries];
      localStorage.setItem("medicationAuditLogs", JSON.stringify(updatedLogs));

      console.log(
        "✅ Saved to local audit:",
        localAuditEntries.length,
        "entries (basket preserved)",
      );
      setAuditLogs(updatedLogs);

      return localAuditEntries;
    } catch (error) {
      console.error("Error saving to local audit:", error);
      return [];
    }
  };

  const loadLocalAuditLogs = useCallback(() => {
    try {
      const logs = JSON.parse(
        localStorage.getItem("medicationAuditLogs") || "[]",
      );
      setAuditLogs(logs);
    } catch (error) {
      console.error("Error loading local audit logs:", error);
    }
  }, []);

  const clearLocalAuditLogs = () => {
    if (
      window.confirm("Are you sure you want to clear all local audit logs?")
    ) {
      localStorage.removeItem("medicationAuditLogs");
      setAuditLogs([]);
      alert("Local audit logs cleared successfully");
    }
  };

  const exportAuditLogsToExcel = () => {
    if (auditLogs.length === 0) {
      alert("No audit logs to export");
      return;
    }

    try {
      const headers = [
        "Timestamp",
        "Patient ID",
        "Patient Name",
        "Drug Name",
        "Instructions",
        "Expiry Date",
        "Requires Expiry Date",
        "Quantity",
        "Printed By",
        "Basket Preserved",
        "From Group"
      ];

      const BOM = "\uFEFF";

      const csvContent = [
        headers.join(","),
        ...auditLogs.map((log) =>
          [
            `"${new Date(log.timestamp).toLocaleString()}"`,
            `"${log.patientId}"`,
            `"${log.patientName}"`,
            `"${log.drugName}"`,
            `"${log.instructionText}"`,
            `"${log.expiryDate || (log.requiresExpiryDate === false ? 'Specified On Container' : 'N/A')}"`,
            `"${log.requiresExpiryDate !== false ? 'Yes' : 'No'}"`,
            `"${log.printQuantity}"`,
            `"${log.printedBy}"`,
            `"${log.basketPreserved ? 'Yes' : 'No'}"`,
            `"${log.fromGroup || ''}"`
          ].join(","),
        ),
      ].join("\n");

      const blob = new Blob([BOM + csvContent], {
        type: "text/csv;charset=utf-8;",
      });

      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `medication_audit_logs_${new Date().toISOString().split("T")[0]}.csv`,
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert(`Exported ${auditLogs.length} audit logs successfully`);
    } catch (error) {
      console.error("Error exporting audit logs:", error);
      alert("Error exporting audit logs: " + error.message);
    }
  };

  const saveToAuditTrail = async () => {
    console.log("🔄 Starting audit trail process...");
    await saveToLocalAudit();
  };

  const generatePrintPreview = () => {
    if (!patients || basket.length === 0 || !user) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups for printing");
      return;
    }

    const currentDate = new Date().toLocaleDateString("en-GB");
    const logoUrl = getLogoForPrint();

    let labelsHTML = "";

    basket.forEach((item) => {
      const quantity = item.printQuantity || 1;
      for (let i = 0; i < quantity; i++) {
        let displayExpiry = "Specified On The Item's Container";

        if (requiresExpiry(item.requiresExpiryDate) && item.expiryDate && item.expiryDate.includes("/")) {
          const [month, year] = item.expiryDate.split("/");
          displayExpiry = `${month}/20${year}`;
        } else if (requiresExpiry(item.requiresExpiryDate)) {
          displayExpiry = item.expiryDate || "Specified On The Item's Container";
        }

        labelsHTML += `
              <div class="label-container">
                <div class="label-content">
                  <div class="label-header">
                    <div class="logo-container">
                      <img src="${logoUrl}" alt="Pharmacy Logo" class="logo-image" onerror="this.style.display='none'" />
                    </div>
                    <div class="patient-info-header">
                      <div class="mrn-section">
                        M.R.N: ${patients.fullId}
                      </div>
                      <div class="header-separator"></div>
                      <div class="national-id-section">
                        <span class="national-id-label">D.O.B</span>
                        <span class="national-id-number">${patients.NationalID || "N/A"}</span>
                      </div>
                    </div>
                  </div>
                  <div class="patient-name">
                    <strong>${patients.PatientName}</strong>
                  </div>
                  <div class="drug-name">
                    <strong>${item.DrugName}</strong>
                  </div>
                  <div class="instructions">
                    <span>${item.InstructionText}</span>
                  </div>
                  <div class="label-footer">
                    <div class="footer-line">
                      <span class="expiry-info">Exp: ${displayExpiry}</span>
                      <span class="printed-by">By: ${user.fullName}</span>
                    </div>
                    <div class="footer-date">
                      <span>${currentDate}</span>
                    </div>
                  </div>
                </div>
              </div>
            `;
      }
    });

    printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Medication Labels</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }

              body {
                margin: 0 !important;
                padding: 0 !important;
                background: white;
                font-family: "Arial Black", "Arial", sans-serif;
                display: block !important;
              }

              .label-container {
                width: 50mm !important;
                height: 30mm !important;
                border: 1px solid #000;
                padding: 0.2mm;
                margin: 0 !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                display: block !important;
                background: white;
              }

              .label-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                height: 100%;
              }

              .label-header {
                height: 0.7cm;
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                padding-bottom: 0.2mm;
                border-bottom: 1px solid #000;
              }

              .logo-container {
                flex: 0 0 45%;
                display: flex;
                align-items: center;
                justify-content: flex-start;
                height: 100%;
              }

              .logo-image {
                max-height: 0.5cm !important;
                max-width: 100% !important;
                width: auto;
                object-fit: contain;
              }

              .patient-info-header {
                flex: 0 0 55%;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                text-align: right;
                justify-content: space-between;
                height: 100%;
                padding: 0.1mm 0;
              }

              .mrn-section {
                font-size: 5.5pt;
                font-weight: bold;
                line-height: 1.1;
                margin-bottom: 0.5mm;
              }

              .header-separator {
                width: 100%;
                height: 0.3px;
                background-color: #666;
                margin: 0.5mm 0;
              }

              .national-id-section {
                font-size: 5.5pt;
                font-weight: bold;
                line-height: 1.1;
                display: flex;
                gap: 3px;
                margin-top: 0.5mm;
              }

              .national-id-label {
                font-weight: bold;
                color: #333;
              }

              .national-id-number {
                font-weight: normal;
                color: #000;
              }

              .patient-name {
                height: 0.35cm;
                text-align: center;
                margin: 0.2mm 0;
                padding: 0.2mm 0;
                line-height: 1;
                overflow: hidden;
                border-bottom: 1px solid #000;
                font-size: 7.5pt;
                font-weight: 900;
                font-family: "Arial Black", "Arial", sans-serif;
              }

              .patient-name strong {
                display: block;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }

              .drug-name {
                height: 0.35cm;
                text-align: center;
                margin: 0.2mm 0;
                padding: 0.2mm 0;
                line-height: 1;
                overflow: hidden;
                border-bottom: 1px solid #000;
                font-size: 7pt;
                font-weight: 900;
                font-family: "Arial Black", "Arial", sans-serif;
              }

              .drug-name strong {
                display: block;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }

              .instructions {
                flex: 1;
                min-height: 0.75cm;
                margin: 0.2mm 0;
                padding: 0.4mm;
                line-height: 1.3;
                overflow: hidden;
                border-bottom: 1px solid #000;
                font-size: 7pt;
                font-weight: bold;
                font-family: "Arial", sans-serif;
              }

              .instructions span {
                display: block;
                word-wrap: break-word;
                line-height: 1.1;
                height: 100%;
                overflow: hidden;
                text-align: center;
                direction: rtl;
                font-weight: bold;
              }

              .label-footer {
                height: 0.45cm;
                font-size: 5.25pt;
                font-weight: bold;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                padding-top: 0.2mm;
                background: white;
              }

              .footer-line {
                display: flex;
                justify-content: space-between;
                align-items: center;
                height: 0.25cm;
                padding: 0.1mm 0;
              }

              .expiry-info, .printed-by {
                font-weight: 900;
                color: #000;
                font-size: 5.25pt;
                text-transform: uppercase;
                letter-spacing: 0.1px;
              }

              .expiry-info {
                flex: 1;
                text-align: left;
              }

              .printed-by {
                flex: 1;
                text-align: right;
              }

              .footer-date {
                text-align: center;
                font-weight: 900;
                font-size: 5.25pt;
                color: #000;
                height: 0.2cm;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0.1mm 0;
              }

              .footer-date span {
                font-weight: 900;
                text-transform: uppercase;
              }

              @media print {
                @page {
                  margin: 0 !important;
                  padding: 0 !important;
                  size: 50mm 30mm !important;
                }

                body {
                  margin: 0 !important;
                  padding: 0 !important;
                  display: block !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }

                .label-container {
                  width: 50mm !important;
                  height: 30mm !important;
                  margin: 0 !important;
                  padding: 0.2mm !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                  display: block !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }

                .label-container, .label-container * {
                  visibility: visible;
                  color: black !important;
                  background: white !important;
                }

                body * {
                  visibility: hidden;
                }

                .label-container {
                  position: relative;
                  left: 0;
                  top: 0;
                }

                .expiry-info, .printed-by, .footer-date span {
                  color: #000000 !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
              }

              @media print and (color) {
                .label-container {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  filter: contrast(120%) !important;
                }

                .patient-name strong,
                .drug-name strong,
                .instructions span {
                  color: #000000 !important;
                }
              }
            </style>
          </head>
          <body>
            ${labelsHTML}
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  setTimeout(function() {
                    window.close();
                  }, 100);
                }, 100);
              }

              window.onafterprint = function() {
                window.close();
              };
            </script>
          </body>
          </html>
        `);
    printWindow.document.close();
  };

  const printLabels = async () => {
    if (!patients) {
      alert("Please search and select a patient first!");
      return;
    }

    if (basket.length === 0) {
      alert("Basket is empty. Please add medications first.");
      return;
    }

    const medicationsMissingRequiredExpiry = basket.filter((item) => 
      requiresExpiry(item.requiresExpiryDate) && !item.expiryDate
    );

    if (medicationsMissingRequiredExpiry.length > 0) {
      const missingItems = medicationsMissingRequiredExpiry
        .map((item) => item.DrugName)
        .join(", ");
      alert(
        `Please enter expiry dates for medications that require it.\n\nMissing expiry dates for: ${missingItems}`,
      );
      return;
    }

    if (!user) {
      alert("User not logged in");
      return;
    }

    try {
      generatePrintPreview();
      await saveToAuditTrail();
      
      alert(`Labels printed successfully for patient: ${patients.PatientName}! Basket items preserved for next patient.`);
      
    } catch (error) {
      console.error("Print error:", error);
      alert(
        "Print completed, but there was an issue with audit logging. Check console for details.",
      );
    }
  };

  // ==================== RENDER LOGIC ====================
  if (!user) {
    return (
      <div className="App login-container">
        <div className="login-box">
          <h1>💊 Medication Label System</h1>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Username:</label>
              <input
                type="text"
                value={loginData.username}
                onChange={(e) =>
                  setLoginData({ ...loginData, username: e.target.value })
                }
                required
              />
            </div>
            <div className="form-group">
              <label>Password:</label>
              <input
                type="password"
                value={loginData.password}
                onChange={(e) =>
                  setLoginData({ ...loginData, password: e.target.value })
                }
                required
              />
            </div>
            <button type="submit">Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      {/* Header */}
      <header className="app-header">
        <h1>💊 Medication Label Printing System</h1>
        <div className="user-info">
          <span>
            Welcome, <strong>{user.fullName}</strong>
            {isAdmin && <span style={{color: '#ff6b6b', marginLeft: '10px'}}>👑 ADMIN</span>}
          </span>

          {isAdmin && (
            <button onClick={openAdminPanel} className="admin-panel-btn">
              👑 Admin Panel
            </button>
          )}
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === "medications" ? "active" : ""}`}
          onClick={() => setActiveTab("medications")}
        >
          💊 Medications & Printing
        </button>
        <button
          className={`tab-button ${activeTab === "auditLogs" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("auditLogs");
            loadLocalAuditLogs();
          }}
        >
          📊 Audit Logs ({auditLogs.length})
        </button>
      </div>

      {/* Medications Tab Content */}
      {activeTab === "medications" && (
        <div className="main-container">
          {/* Left Panel - Patient Search & Medications */}
          <div className="left-panel">
            {/* Patient Search */}
            <div className="section patient-search">
              <h2>🔍 Patient Search</h2>
              <form onSubmit={handleQuickPatientSearch} className="search-form">
                <div className="input-group">
                  <input
                    type="text"
                    name="patientId"
                    placeholder="Patient ID"
                    required
                  />
                  <input
                    type="text"
                    name="year"
                    placeholder="Year"
                    defaultValue="2025"
                    required
                  />
                  <button type="submit">Search Patient</button>
                </div>
              </form>

              {patients && (
                <div className="patient-info">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0 }}>✅ Patient Found</h3>
                    <button 
                      onClick={resetPatient}
                      style={{
                        padding: '5px 10px',
                        backgroundColor: '#ffc107',
                        color: '#000',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}
                      title="Clear patient but keep basket items"
                    >
                      🔄 Change Patient
                    </button>
                  </div>
                  <p>
                    <strong>Name:</strong> {patients.PatientName}
                  </p>
                  <p>
                    <strong>ID:</strong> {patients.fullId}
                  </p>
                  <p>
                    <strong>National ID:</strong> {patients.NationalID}
                  </p>
                  <div style={{ 
                    marginTop: '10px', 
                    padding: '8px', 
                    backgroundColor: '#e8f4fd', 
                    borderRadius: '5px',
                    fontSize: '12px'
                  }}>
                    <strong>💡 Tip:</strong> Basket items ({basket.length}) are preserved after printing. 
                    Change patient above to print labels for another patient with the same items.
                  </div>
                </div>
              )}
            </div>

            {/* Medications List */}
            <div className="section medications-section">
              <h2>💊 Available Medications & Protocols ({medications.length + medicationGroups.length})</h2>

              {/* Search Box */}
              <input
                type="text"
                placeholder="Search by drug name, protocol name, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
                style={{ textAlign: "right" }}
              />

              {/* Enhanced Custom Drug & Patient Management Buttons */}
              <div className="custom-drug-buttons" style={{ margin: '10px 0', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>

                {/* Show drug management buttons only to authorized users */}
                {canManageDrugs && (
                  <>
                    <button 
                      onClick={openCustomDrugModal}
                      className="add-drug-button"
                      style={{
                        padding: '8px 15px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      💊 Add New Drug to Database
                    </button>

                    <button 
                      onClick={openQuickAddModal}
                      className="quick-add-button"
                      style={{
                        padding: '8px 15px',
                        backgroundColor: '#17a2b8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      ➕ Quick Add Custom Drug
                    </button>
                  </>
                )}

                {/* Medication Groups Management Button (Admin only) */}
                {canManageMedicationGroups && (
                  <button 
                    onClick={openGroupManager}
                    className="group-management-button"
                    style={{
                      padding: '8px 15px',
                      backgroundColor: '#4a6fa5',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    📋 Manage Medication Protocols
                  </button>
                )}

                {/* Show patient management button to all users */}
                {canManagePatients && (
                  <button 
                    onClick={openPatientManagement}
                    className="patient-management-button"
                    style={{
                      padding: '8px 15px',
                      backgroundColor: '#6f42c1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    👥 Manage Patients
                  </button>
                )}

                {/* Admin panel button - only for admin */}
                {canAccessAdminPanel && (
                  <button 
                    onClick={openAdminPanel}
                    className="admin-panel-main-btn"
                    style={{
                      padding: '8px 15px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    👑 Admin Panel
                  </button>
                )}
              </div>

              {/* Show search results info */}
              {searchTerm && (
                <div
                  style={{ margin: "5px 0", fontSize: "0.9em", color: "#666" }}
                >
                  {combinedSearchResults.length} items found for "
                  {searchTerm}"
                  {medicationGroups.filter(g => 
                    g.groupName.toLowerCase().includes(searchTerm.toLowerCase())
                  ).length > 0 && (
                    <span style={{ marginLeft: '10px', color: '#4a6fa5', fontWeight: 'bold' }}>
                      ({medicationGroups.filter(g => 
                        g.groupName.toLowerCase().includes(searchTerm.toLowerCase())
                      ).length} protocols)
                    </span>
                  )}
                </div>
              )}

              {/* Quick Protocol Info */}
              {medicationGroups.length > 0 && !searchTerm && (
                <div style={{ 
                  margin: '10px 0', 
                  padding: '10px', 
                  backgroundColor: '#f0f8ff',
                  borderRadius: '5px',
                  border: '1px solid #4a6fa5'
                }}>
                  <strong>📋 Available Protocols ({medicationGroups.length}):</strong>
                  <div style={{ marginTop: '5px', fontSize: '13px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {medicationGroups.slice(0, 5).map(group => (
                      <span key={group.groupId} style={{
                        backgroundColor: '#4a6fa5',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                      onClick={() => setSearchTerm(group.groupName)}
                      title={`Click to search for "${group.groupName}"`}
                      >
                        {group.groupName}
                      </span>
                    ))}
                    {medicationGroups.length > 5 && (
                      <span style={{ color: '#666', fontSize: '12px' }}>
                        +{medicationGroups.length - 5} more...
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                    <strong>Tip:</strong> Search for protocol names or click above to quickly add medication groups to basket.
                  </div>
                </div>
              )}

              {/* Custom Instruction Toggle */}
              <div className="custom-instruction-toggle">
                <label>
                  <input
                    type="checkbox"
                    checked={useCustomInstruction}
                    onChange={(e) => setUseCustomInstruction(e.target.checked)}
                  />
                  Use Custom Instruction
                </label>
                {useCustomInstruction && (
                  <textarea
                    placeholder="Enter custom instruction..."
                    value={customInstruction}
                    onChange={(e) => setCustomInstruction(e.target.value)}
                    rows="3"
                  />
                )}
              </div>

              {/* Medications & Groups List */}
              <div className="medications-list">
                {combinedSearchResults.length === 0 && searchTerm ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "20px",
                      color: "#666",
                    }}
                  >
                    No medications or protocols found for "{searchTerm}"
                  </div>
                ) : (
                  combinedSearchResults.map((item, index) => (
                    <MedicationItem
                      key={item.isGroup ? `group-${item.groupId}` : createUniqueKey(item, index)}
                      medication={item}
                      patients={patients}
                      addToBasket={addToBasket}
                      doesNotRequireExpiry={doesNotRequireExpiry}
                      isGroup={item.isGroup}
                      onAddGroup={addGroupToBasket}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Basket & Print Controls */}
          <div className="right-panel">
            {/* Basket */}
            <div className="section basket-section">
              <h2>🛒 Medication Basket ({basket.length} items)</h2>

              {basket.length === 0 ? (
                <p className="empty-basket">Basket is empty</p>
              ) : (
                <div className="basket-list">
                  {basket.map((item) => (
                    <BasketItem
                      key={item.TempID}
                      item={item}
                      updateMedicationQuantity={updateMedicationQuantity}
                      handleExpiryMonthChange={handleExpiryMonthChange}
                      handleExpiryYearChange={handleExpiryYearChange}
                      removeFromBasket={removeFromBasket}
                      requiresExpiry={requiresExpiry}
                      months={months}
                      years={years}
                    />
                  ))}
                </div>
              )}

              {/* Basket Controls */}
              {basket.length > 0 && (
                <div className="basket-controls" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button onClick={clearBasket} className="clear-btn">
                    🗑️ Clear Entire Basket
                  </button>
                  
                  <button 
                    onClick={copyBasket}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#17a2b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                    title="Create a copy of current basket"
                  >
                    📋 Copy Basket
                  </button>
                  
                  <button 
                    onClick={resetExpiryDates}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#ffc107',
                      color: '#000',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                    title="Reset all expiry dates"
                  >
                    🔄 Reset Expiry Dates
                  </button>
                </div>
              )}
            </div>

            {/* Print Controls */}
            {patients && basket.length > 0 && (
              <div className="section print-section">
                <h2>🖨️ Print Labels</h2>
                
                <div style={{ 
                  marginBottom: '15px', 
                  padding: '10px', 
                  backgroundColor: '#e8f5e8', 
                  borderRadius: '5px',
                  border: '1px solid #28a745'
                }}>
                  <strong>⚠️ Basket Preservation Mode:</strong> 
                  <p style={{ margin: '5px 0 0 0', fontSize: '13px' }}>
                    After printing, basket items will <strong>NOT</strong> be cleared. 
                    You can change patients and print again with the same items.
                  </p>
                </div>

                <div className="print-controls">
                  <button onClick={printLabels} className="print-btn">
                    🖨️ Print All Labels
                  </button>

                  <div className="print-summary">
                    <p>
                      <strong>Print Summary:</strong>
                    </p>
                    <p>Patient: {patients.PatientName}</p>
                    <p>Total Labels: {totalLabelsCount}</p>
                    <p>Medications: {basket.length}</p>
                    <p
                      style={{
                        color: medicationsMissingRequiredExpiry.length > 0 
                          ? "red"
                          : "green",
                      }}
                    >
                      Expiry Dates:{" "}
                      {medicationsRequiringExpiry.filter(item => item.expiryDate).length}/ 
                      {medicationsRequiringExpiry.length} set
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audit Logs Tab Content */}
      {activeTab === "auditLogs" && (
        <div className="audit-logs-container">
          <div className="section">
            <h2>📊 Medication Printing Audit Logs</h2>

            <div className="audit-controls">
              <button onClick={loadLocalAuditLogs} className="refresh-btn">
                🔄 Refresh Logs
              </button>
              <button
                onClick={exportAuditLogsToExcel}
                className="export-btn"
                disabled={auditLogs.length === 0}
              >
                📈 Export to Excel ({auditLogs.length} records)
              </button>
              <button onClick={clearLocalAuditLogs} className="clear-logs-btn">
                🗑️ Clear All Logs
              </button>
            </div>

            {auditLogs.length === 0 ? (
              <div className="no-logs-message">
                <p>No audit logs found. Printed labels will appear here.</p>
              </div>
            ) : (
              <div className="audit-logs-list">
                <div className="logs-summary">
                  <p>
                    Total Records: <strong>{auditLogs.length}</strong>
                  </p>
                  <p>
                    Last Updated: <strong>{new Date().toLocaleString()}</strong>
                  </p>
                </div>

                <div className="logs-table-container">
                  <table className="audit-logs-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Patient Name</th>
                        <th>Patient ID</th>
                        <th>Drug Name</th>
                        <th>Instructions</th>
                        <th>Expiry Date</th>
                        <th>Requires Expiry</th>
                        <th>Quantity</th>
                        <th>Printed By</th>
                        <th>Basket Preserved</th>
                        <th>From Group</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs
                        .slice()
                        .reverse()
                        .map((log, index) => (
                          <tr
                            key={log.id}
                            className={index % 2 === 0 ? "even" : "odd"}
                          >
                            <td>{new Date(log.timestamp).toLocaleString()}</td>
                            <td>{log.patientName}</td>
                            <td>{log.patientId}</td>
                            <td>{log.drugName}</td>
                            <td>{log.instructionText}</td>
                            <td>{log.expiryDate || (log.requiresExpiryDate === false ? 'Specified On Container' : 'N/A')}</td>
                            <td>{log.requiresExpiryDate !== false ? 'Yes' : 'No'}</td>
                            <td>{log.printQuantity}</td>
                            <td>{log.printedBy}</td>
                            <td>{log.basketPreserved ? 'Yes' : 'No'}</td>
                            <td>{log.fromGroup || '-'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Drug Modal */}
      {showCustomDrugModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>
                {addingToBasket ? '➕ Quick Add Custom Drug' : '💊 Add New Drug to Database'}
              </h2>
              <button className="close-button" onClick={closeCustomDrugModal}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Drug Name *</label>
                <input
                  type="text"
                  value={customDrugData.drugName}
                  onChange={(e) => handleCustomDrugInputChange('drugName', e.target.value)}
                  placeholder="Enter drug name..."
                  required
                />
              </div>

              <div className="form-group">
                <label>Instructions</label>
                <textarea
                  value={customDrugData.instructionText}
                  onChange={(e) => handleCustomDrugInputChange('instructionText', e.target.value)}
                  placeholder="Enter usage instructions..."
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>Active Ingredient (المادة الفعالة)</label>
                <input
                  type="text"
                  value={customDrugData.activeIngredient}
                  onChange={(e) => handleCustomDrugInputChange('activeIngredient', e.target.value)}
                  placeholder="Enter active ingredient..."
                />
              </div>

              <div className="form-group">
                <label>International Code (Barcode)</label>
                <input
                  type="text"
                  value={customDrugData.internationalCode}
                  onChange={(e) => handleCustomDrugInputChange('internationalCode', e.target.value)}
                  placeholder="Enter barcode number..."
                />
              </div>

              {/* REQUIRES EXPIRY DATE CHECKBOX */}
              <div className="form-group" style={{ 
                marginTop: '15px', 
                padding: '10px',
                backgroundColor: '#f8f9fa',
                borderRadius: '5px',
                border: '1px solid #dee2e6'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={customDrugData.requiresExpiryDate}
                    onChange={(e) => {
                      console.log("Checkbox changed:", e.target.checked);
                      handleCustomDrugInputChange('requiresExpiryDate', e.target.checked);
                    }}
                    style={{ 
                      marginRight: '10px',
                      width: '18px',
                      height: '18px'
                    }}
                  />
                  <strong style={{ fontSize: '14px', color: '#333' }}>
                    ☑️ Requires Expiry Date on Label
                  </strong>
                </label>
                <small style={{ display: 'block', marginTop: '5px', color: '#6c757d', marginLeft: '28px' }}>
                  {customDrugData.requiresExpiryDate 
                    ? '✓ This drug WILL require an expiry date when added to basket' 
                    : '✗ This drug will NOT require an expiry date (will show "Specified On The Item\'s Container")'}
                </small>
              </div>

              <div className="modal-actions">
                <button 
                  className="secondary-button" 
                  onClick={closeCustomDrugModal}
                >
                  Cancel
                </button>

                {addingToBasket ? (
                  <button 
                    className="primary-button" 
                    onClick={quickAddCustomDrug}
                    disabled={!customDrugData.drugName.trim()}
                  >
                    ➕ Add to Basket Only
                  </button>
                ) : (
                  <button 
                    className="primary-button" 
                    onClick={saveCustomDrug}
                    disabled={!customDrugData.drugName.trim()}
                  >
                    💾 Save to Database & Add to Basket
                  </button>
                )}
              </div>

              <div className="modal-info">
                <p>
                  <strong>Note:</strong> 
                  {addingToBasket 
                    ? ' This will add the drug to your basket only (not saved to database).' 
                    : ' This will save the drug to the database and add it to your basket.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Medication Groups Manager Modal */}
      {showGroupManager && (
        <div className="modal-overlay">
          <div className="modal-content extra-large-modal">
            <div className="modal-header">
              <h2>📋 Medication Protocols Management</h2>
              <button className="close-button" onClick={closeGroupManager}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Admin only message */}
              {!isAdmin ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <h3>⛔ Access Denied</h3>
                  <p>Only system administrators can manage medication protocols.</p>
                  <p>Please contact your administrator to create or modify medication groups.</p>
                </div>
              ) : (
                <>
                  {/* Search and Add Controls */}
                  <div className="group-management-controls">
                    <div className="search-container">
                      <form onSubmit={(e) => { e.preventDefault(); }} className="search-form">
                        <input
                          type="text"
                          placeholder="Search protocols..."
                          value={groupSearchTerm}
                          onChange={(e) => setGroupSearchTerm(e.target.value)}
                          className="search-input"
                        />
                        <button type="button" onClick={() => setGroupSearchTerm('')} className="clear-search">
                          Clear
                        </button>
                      </form>
                    </div>

                    <button onClick={openAddGroupModal} className="add-group-btn">
                      ➕ Create New Protocol
                    </button>
                  </div>

                  {/* Groups List */}
                  <div className="groups-list-container">
                    <div className="list-header">
                      <h3>Available Protocols ({medicationGroups.length} total)</h3>
                      <div className="protocols-info">
                        Protocols allow quick addition of multiple medications at once
                      </div>
                    </div>

                    {medicationGroups.length === 0 ? (
                      <div className="no-groups-message">
                        <p>No medication protocols found. Create your first protocol to save time!</p>
                      </div>
                    ) : (
                      <>
                        <div className="groups-table-container">
                          <table className="groups-table">
                            <thead>
                              <tr>
                                <th>Protocol Name</th>
                                <th>Description</th>
                                <th>Medications</th>
                                <th>Created By</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {medicationGroups
                                .filter(group => 
                                  !groupSearchTerm || 
                                  group.groupName.toLowerCase().includes(groupSearchTerm.toLowerCase()) ||
                                  (group.description && group.description.toLowerCase().includes(groupSearchTerm.toLowerCase()))
                                )
                                .map((group, index) => (
                                  <tr key={group.groupId} className={index % 2 === 0 ? 'even' : 'odd'}>
                                    <td className="group-name-cell">
                                      <strong>{group.groupName}</strong>
                                    </td>
                                    <td>{group.description || 'No description'}</td>
                                    <td>
                                      <span style={{
                                        backgroundColor: '#4a6fa5',
                                        color: 'white',
                                        padding: '2px 8px',
                                        borderRadius: '10px',
                                        fontSize: '12px',
                                        fontWeight: 'bold'
                                      }}>
                                        {group.drugCount || 0} medications
                                      </span>
                                    </td>
                                    <td>{group.createdBy || 'Admin'}</td>
                                    <td className="group-actions">
                                      <button 
                                        onClick={() => viewGroupDetails(group)}
                                        className="view-group-btn"
                                        title="View protocol details"
                                      >
                                        👁️ View
                                      </button>
                                      <button 
                                        onClick={() => editMedicationGroup(group)}
                                        className="edit-group-btn"
                                        title="Edit protocol"
                                      >
                                        ✏️ Edit
                                      </button>
                                      <button 
                                        onClick={() => deleteMedicationGroup(group)}
                                        className="delete-group-btn"
                                        title="Delete protocol"
                                      >
                                        🗑️ Delete
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Medication Group Modal */}
      {showAddGroupModal && isAdmin && (
        <div className="modal-overlay">
          <div className="modal-content extra-large-modal">
            <div className="modal-header">
              <h2>{editingGroup ? '✏️ Edit Medication Protocol' : '➕ Create New Medication Protocol'}</h2>
              <button className="close-button" onClick={closeAddGroupModal}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'flex', gap: '20px', height: '500px' }}>
                {/* Left side: Group info and selected drugs */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div className="form-group">
                    <label>Protocol Name *</label>
                    <input
                      type="text"
                      value={editingGroup ? editingGroup.groupName : newGroupData.groupName}
                      onChange={(e) => handleGroupInputChange('groupName', e.target.value)}
                      placeholder="e.g., Hormonal Treatment 1, Post-Op Protocol"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      value={editingGroup ? editingGroup.description : newGroupData.description}
                      onChange={(e) => handleGroupInputChange('description', e.target.value)}
                      placeholder="Brief description of this protocol (optional)"
                      rows="3"
                    />
                  </div>

                  <div style={{ flex: 1, marginTop: '15px' }}>
                    <h4>Medications in this Protocol ({editingGroup ? editingGroup.drugs.length : newGroupData.drugs.length})</h4>
                    
                    {(editingGroup ? editingGroup.drugs : newGroupData.drugs).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                        No medications added yet. Select medications from the right panel.
                      </div>
                    ) : (
                      <div style={{ 
                        border: '1px solid #dee2e6', 
                        borderRadius: '5px', 
                        padding: '10px',
                        maxHeight: '300px',
                        overflowY: 'auto'
                      }}>
                        {(editingGroup ? editingGroup.drugs : newGroupData.drugs).map((drug, index) => (
                          <div key={drug.DrugID} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px',
                            backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'white',
                            borderBottom: '1px solid #eee'
                          }}>
                            <div>
                              <strong>{drug.DrugName}</strong>
                              <div style={{ fontSize: '12px', color: '#666' }}>
                                Default quantity: 
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={drug.defaultQuantity || 1}
                                  onChange={(e) => updateDrugQuantityInGroup(drug.DrugID, e.target.value)}
                                  style={{
                                    width: '50px',
                                    marginLeft: '10px',
                                    padding: '3px',
                                    fontSize: '12px'
                                  }}
                                />
                              </div>
                            </div>
                            <button 
                              onClick={() => removeDrugFromGroup(drug.DrugID)}
                              style={{
                                backgroundColor: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                padding: '3px 8px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side: Available drugs */}
                <div style={{ flex: 1, borderLeft: '1px solid #dee2e6', paddingLeft: '20px' }}>
                  <h4>Available Medications</h4>
                  <div style={{ marginBottom: '10px' }}>
                    <input
                      type="text"
                      placeholder="Search medications..."
                      style={{ width: '100%', padding: '8px' }}
                      onChange={(e) => {
                        // Simple client-side filtering
                        const search = e.target.value.toLowerCase();
                        // We'll implement search in the list display
                      }}
                    />
                  </div>
                  
                  <div style={{ 
                    border: '1px solid #dee2e6', 
                    borderRadius: '5px', 
                    padding: '10px',
                    height: '350px',
                    overflowY: 'auto'
                  }}>
                    {availableDrugsForGroup.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                        Loading medications...
                      </div>
                    ) : (
                      availableDrugsForGroup.map((drug, index) => {
                        const isAlreadyAdded = (editingGroup ? editingGroup.drugs : newGroupData.drugs)
                          .some(d => d.DrugID === drug.DrugID);
                        
                        return (
                          <div key={drug.DrugID} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px',
                            backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'white',
                            borderBottom: '1px solid #eee',
                            opacity: isAlreadyAdded ? 0.6 : 1
                          }}>
                            <div>
                              <strong>{drug.DrugName}</strong>
                              <div style={{ fontSize: '12px', color: '#666' }}>
                                {drug.active_ingredient && `Active: ${drug.active_ingredient}`}
                              </div>
                            </div>
                            {isAlreadyAdded ? (
                              <span style={{ color: '#28a745', fontSize: '12px', fontWeight: 'bold' }}>
                                ✓ Added
                              </span>
                            ) : (
                              <button 
                                onClick={() => addDrugToGroup(drug)}
                                style={{
                                  backgroundColor: '#28a745',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '3px',
                                  padding: '3px 8px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                Add
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button 
                  className="secondary-button" 
                  onClick={closeAddGroupModal}
                >
                  Cancel
                </button>

                {editingGroup ? (
                  <button 
                    className="primary-button" 
                    onClick={updateMedicationGroup}
                    disabled={!editingGroup.groupName || editingGroup.drugs.length === 0}
                  >
                    💾 Update Protocol
                  </button>
                ) : (
                  <button 
                    className="primary-button" 
                    onClick={saveMedicationGroup}
                    disabled={!newGroupData.groupName || newGroupData.drugs.length === 0}
                  >
                    💾 Create Protocol
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Group Details Modal */}
      {showGroupDetailsModal && selectedGroupDetails && (
        <div className="modal-overlay">
          <div className="modal-content large-modal">
            <div className="modal-header">
              <h2>📋 Protocol Details: {selectedGroupDetails.groupName}</h2>
              <button className="close-button" onClick={() => setShowGroupDetailsModal(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              {selectedGroupDetails.description && (
                <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
                  <strong>Description:</strong> {selectedGroupDetails.description}
                </div>
              )}

              <h4>Medications in this Protocol ({selectedGroupDetails.drugs?.length || 0})</h4>
              
              {!selectedGroupDetails.drugs || selectedGroupDetails.drugs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                  No medications in this protocol
                </div>
              ) : (
                <div style={{ 
                  border: '1px solid #dee2e6', 
                  borderRadius: '5px', 
                  padding: '10px',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {selectedGroupDetails.drugs.map((drug, index) => (
                    <div key={drug.DrugID} style={{
                      padding: '10px',
                      backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'white',
                      borderBottom: '1px solid #eee',
                      marginBottom: '5px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <strong style={{ fontSize: '14px' }}>{drug.DrugName}</strong>
                          <div style={{ fontSize: '12px', color: '#666', marginTop: '3px' }}>
                            <div>Default Quantity: <strong>{drug.defaultQuantity || 1} labels</strong></div>
                            {drug.Instruction && <div>Instructions: {drug.Instruction}</div>}
                            {drug.active_ingredient && <div>Active Ingredient: {drug.active_ingredient}</div>}
                            <div>Requires Expiry Date: {drug.requires_expiry_date !== false ? 'Yes' : 'No'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button 
                  className="secondary-button" 
                  onClick={() => setShowGroupDetailsModal(false)}
                >
                  Close
                </button>

                <button 
                  className="primary-button" 
                  onClick={() => addGroupToBasket(selectedGroupDetails)}
                  disabled={!patients}
                >
                  ➕ Add Protocol to Basket
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Patient Management Modal */}
      {showPatientManagement && (
        <div className="modal-overlay">
          <div className="modal-content large-modal">
            <div className="modal-header">
              <h2>👥 Patient Management</h2>
              <button className="close-button" onClick={closePatientManagement}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Search and Add Controls */}
              <div className="patient-management-controls">
                <div className="search-container">
                  <form onSubmit={handlePatientSearch} className="search-form">
                    <input
                      type="text"
                      placeholder="Search by name, ID, or national ID..."
                      value={patientSearchTerm}
                      onChange={(e) => setPatientSearchTerm(e.target.value)}
                      className="search-input"
                    />
                    <button type="submit">🔍 Search</button>
                    {patientSearchTerm && (
                      <button type="button" onClick={clearPatientSearch} className="clear-search">
                        Clear
                      </button>
                    )}
                  </form>
                </div>

                <button onClick={openAddPatientModal} className="add-patient-btn">
                  ➕ Add New Patient
                </button>
              </div>

              {/* Patients List */}
              <div className="patients-list-container">
                <div className="list-header">
                  <h3>Patients List ({patientsPagination.total} total)</h3>
                  <div className="pagination-info">
                    Page {patientsPagination.page} of {patientsPagination.totalPages}
                  </div>
                </div>

                {patientsList.length === 0 ? (
                  <div className="no-patients-message">
                    <p>No patients found. {patientSearchTerm ? 'Try a different search.' : 'Add your first patient!'}</p>
                  </div>
                ) : (
                  <>
                    <div className="patients-table-container">
                      <table className="patients-table">
                        <thead>
                          <tr>
                            <th>Patient ID</th>
                            <th>Year</th>
                            <th>Patient Name</th>
                            <th>National ID</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {patientsList.map((patient, index) => (
                            <tr key={`${patient.PatientID}-${patient.Year}-${index}`} 
                                className={index % 2 === 0 ? 'even' : 'odd'}>
                              <td>{patient.PatientID}</td>
                              <td>{patient.Year}</td>
                              <td className="patient-name-cell">{patient.PatientName}</td>
                              <td>{patient.NationalID || 'N/A'}</td>
                              <td className="actions-cell">
                                <button 
                                  onClick={() => selectPatientFromList(patient)}
                                  className="select-btn"
                                  title="Select this patient"
                                >
                                  ✅ Select
                                </button>
                                <button 
                                  onClick={() => editPatient(patient)}
                                  className="edit-btn"
                                  title="Edit patient"
                                >
                                  ✏️ Edit
                                </button>
                                <button 
                                  onClick={() => deletePatient(patient)}
                                  className="delete-btn"
                                  title="Delete patient"
                                >
                                  🗑️ Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {patientsPagination.totalPages > 1 && (
                      <div className="pagination-controls">
                        <button 
                          onClick={() => loadPatientsList(patientsPagination.page - 1, patientSearchTerm)}
                          disabled={patientsPagination.page <= 1}
                          className="pagination-btn"
                        >
                          ◀ Previous
                        </button>

                        <span className="page-info">
                          Page {patientsPagination.page} of {patientsPagination.totalPages}
                        </span>

                        <button 
                          onClick={() => loadPatientsList(patientsPagination.page + 1, patientSearchTerm)}
                          disabled={patientsPagination.page >= patientsPagination.totalPages}
                          className="pagination-btn"
                        >
                          Next ▶
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Current Patient Info */}
              {patients && (
                <div className="current-patient-info">
                  <h4>✅ Currently Selected Patient:</h4>
                  <p><strong>Name:</strong> {patients.PatientName}</p>
                  <p><strong>ID:</strong> {patients.fullId}</p>
                  {patients.NationalID && <p><strong>National ID:</strong> {patients.NationalID}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Patient Modal */}
      {showAddPatientModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingPatient ? '✏️ Edit Patient' : '➕ Add New Patient'}</h2>
              <button className="close-button" onClick={closeAddPatientModal}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Patient ID *</label>
                <input
                  type="text"
                  value={editingPatient ? editingPatient.PatientID : newPatientData.patientId}
                  onChange={(e) => handlePatientInputChange('patientId', e.target.value)}
                  placeholder="Enter patient ID"
                  required
                  disabled={!!editingPatient}
                />
              </div>

              <div className="form-group">
                <label>Year *</label>
                <input
                  type="text"
                  value={editingPatient ? editingPatient.Year : newPatientData.year}
                  onChange={(e) => handlePatientInputChange('year', e.target.value)}
                  placeholder="Enter year (e.g., 25)"
                  required
                  disabled={!!editingPatient}
                />
                <small>Two-digit year format (e.g., 25 for 2025)</small>
              </div>

              <div className="form-group">
                <label>Patient Name *</label>
                <input
                  type="text"
                  value={editingPatient ? editingPatient.PatientName : newPatientData.patientName}
                  onChange={(e) => handlePatientInputChange('patientName', e.target.value)}
                  placeholder="Enter patient full name"
                  required
                />
              </div>

              <div className="form-group">
                <label>National ID</label>
                <input
                  type="text"
                  value={editingPatient ? editingPatient.NationalID : newPatientData.nationalId}
                  onChange={(e) => handlePatientInputChange('nationalId', e.target.value)}
                  placeholder="Enter national ID (optional)"
                />
              </div>

              <div className="modal-actions">
                <button 
                  className="secondary-button" 
                  onClick={closeAddPatientModal}
                >
                  Cancel
                </button>

                {editingPatient ? (
                  <button 
                    className="primary-button" 
                    onClick={updatePatient}
                    disabled={!editingPatient.PatientName}
                  >
                    💾 Update Patient
                  </button>
                ) : (
                  <button 
                    className="primary-button" 
                    onClick={addNewPatient}
                    disabled={!newPatientData.patientId || !newPatientData.year || !newPatientData.patientName}
                  >
                    💾 Add Patient
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Panel Modal */}
      {showAdminPanel && (
        <div className="modal-overlay">
          <div className="modal-content extra-large-modal">
            <div className="modal-header">
              <h2>👑 System Administration Panel</h2>
              <button className="close-button" onClick={closeAdminPanel}>✕</button>
            </div>

            <div className="modal-body">
              {/* Admin Navigation Tabs */}
              <div className="admin-tabs">
                <button className={`admin-tab ${adminActiveTab === "dashboard" ? "active" : ""}`} onClick={() => setAdminActiveTab("dashboard")}>
                  📊 Dashboard
                </button>
                <button className={`admin-tab ${adminActiveTab === "users" ? "active" : ""}`} onClick={() => setAdminActiveTab("users")}>
                  👥 User Management
                </button>
                <button className={`admin-tab ${adminActiveTab === "statistics" ? "active" : ""}`} onClick={() => setAdminActiveTab("statistics")}>
                  📈 Statistics
                </button>
                <button className={`admin-tab ${adminActiveTab === "activity" ? "active" : ""}`} onClick={() => setAdminActiveTab("activity")}>
                  🔄 Recent Activity
                </button>
                <button className={`admin-tab ${adminActiveTab === "protocols" ? "active" : ""}`} onClick={() => setAdminActiveTab("protocols")}>
                  📋 Medication Protocols
                </button>
              </div>

              {/* Dashboard Tab */}
              {adminActiveTab === "dashboard" && (
                <div className="admin-dashboard">
                  <h3>System Overview</h3>

                  <div className="dashboard-cards">
                    <div className="dashboard-card">
                      <h4>💊 Medications</h4>
                      <p className="card-number">{adminStatistics.medicationsCount || 0}</p>
                      <p>Total drugs in database</p>
                    </div>
                    <div className="dashboard-card">
                      <h4>👥 Patients</h4>
                      <p className="card-number">{adminStatistics.patientsCount || 0}</p>
                      <p>Registered patients</p>
                    </div>
                    <div className="dashboard-card">
                      <h4>👤 Users</h4>
                      <p className="card-number">{adminStatistics.usersCount || 0}</p>
                      <p>System users</p>
                    </div>
                    <div className="dashboard-card">
                      <h4>📋 Audit Logs</h4>
                      <p className="card-number">{adminStatistics.auditLogsCount || 0}</p>
                      <p>Printed labels</p>
                    </div>
                    <div className="dashboard-card">
                      <h4>📊 Protocols</h4>
                      <p className="card-number">{adminStatistics.medicationGroupsCount || 0}</p>
                      <p>Medication protocols</p>
                    </div>
                  </div>

                  <div className="quick-actions">
                    <h4>Quick Actions</h4>
                    <div className="action-buttons">
                      <button onClick={openPatientManagement} className="action-btn">
                        👥 Manage Patients
                      </button>
                      <button onClick={openCustomDrugModal} className="action-btn">
                        💊 Add New Drug
                      </button>
                      <button onClick={openGroupManager} className="action-btn">
                        📋 Manage Protocols
                      </button>
                      <button onClick={() => setAdminActiveTab('users')} className="action-btn">
                        👤 Manage Users
                      </button>
                      <button onClick={loadAdminStatistics} className="action-btn">
                        🔄 Refresh Stats
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* User Management Tab */}
              {adminActiveTab === 'users' && (
                <div className="user-management">
                  <div className="section-header">
                    <h3>👥 User Management</h3>
                    <button onClick={openAddUserModal} className="add-user-btn">
                      ➕ Add New User
                    </button>
                  </div>

                  <div className="users-table-container">
                    <table className="users-table">
                      <thead>
                        <tr>
                          <th>Username</th>
                          <th>Full Name</th>
                          <th>Access Level</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminUsers.map((user, index) => (
                          <tr key={user.UserID} className={index % 2 === 0 ? 'even' : 'odd'}>
                            <td>{user.UserName}</td>
                            <td>{user.FullName}</td>
                            <td>
                              <span className={`access-level ${user.AccessLevel}`}>
                                {user.AccessLevel}
                              </span>
                            </td>
                            <td>
                              <span className={`status ${user.IsActive ? 'active' : 'inactive'}`}>
                                {user.IsActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="user-actions">
                              <button 
                                onClick={() => editUser(user)}
                                className="edit-user-btn"
                                title="Edit user"
                              >
                                ✏️ Edit
                              </button>
                              {user.UserName !== "mahmoud_abdelkader" && (
                                <button 
                                  onClick={() => deleteUser(user)}
                                  className="delete-user-btn"
                                  title="Delete user"
                                >
                                  🗑️ Delete
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Statistics Tab */}
              {adminActiveTab === 'statistics' && (
                <div className="statistics-tab">
                  <h3>📈 System Statistics</h3>
                  <div className="stats-grid">
                    <div className="stat-item">
                      <h4>Database Overview</h4>
                      <ul>
                        <li>Medications: <strong>{adminStatistics.medicationsCount || 0}</strong></li>
                        <li>Patients: <strong>{adminStatistics.patientsCount || 0}</strong></li>
                        <li>Users: <strong>{adminStatistics.usersCount || 0}</strong></li>
                        <li>Audit Logs: <strong>{adminStatistics.auditLogsCount || 0}</strong></li>
                        <li>Protocols: <strong>{adminStatistics.medicationGroupsCount || 0}</strong></li>
                      </ul>
                    </div>
                    <div className="stat-item">
                      <h4>Quick Actions</h4>
                      <button onClick={loadAdminStatistics} className="refresh-stats-btn">
                        🔄 Refresh Statistics
                      </button>
                      <button onClick={() => setAdminActiveTab('users')} className="manage-users-btn">
                        👥 Manage Users
                      </button>
                      <button onClick={openGroupManager} className="manage-protocols-btn">
                        📋 Manage Protocols
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Activity Tab */}
              {adminActiveTab === 'activity' && (
                <div className="activity-tab">
                  <h3>🔄 Recent System Activity</h3>
                  <div className="activities-list">
                    {recentActivities.length === 0 ? (
                      <p>No recent activity found.</p>
                    ) : (
                      <div className="activities-table-container">
                        <table className="activities-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Patient</th>
                              <th>Drug</th>
                              <th>Printed By</th>
                              <th>From Protocol</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentActivities.map((activity, index) => (
                              <tr key={index} className={index % 2 === 0 ? 'even' : 'odd'}>
                                <td>{new Date(activity.timestamp).toLocaleString()}</td>
                                <td>{activity.patientName}</td>
                                <td>{activity.drugName}</td>
                                <td>{activity.printedBy}</td>
                                <td>{activity.fromGroup || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Medication Protocols Tab */}
              {adminActiveTab === 'protocols' && (
                <div className="protocols-tab">
                  <div className="section-header">
                    <h3>📋 Medication Protocols Management</h3>
                    <button onClick={openGroupManager} className="manage-protocols-main-btn">
                      📋 Open Protocol Manager
                    </button>
                  </div>

                  <div className="protocols-stats">
                    <div className="stats-card">
                      <h4>Total Protocols</h4>
                      <p className="stat-number">{medicationGroups.length}</p>
                    </div>
                    <div className="stats-card">
                      <h4>Average Medications per Protocol</h4>
                      <p className="stat-number">
                        {medicationGroups.length > 0 
                          ? Math.round(medicationGroups.reduce((sum, group) => sum + (group.drugCount || 0), 0) / medicationGroups.length)
                          : 0}
                      </p>
                    </div>
                  </div>

                  <div className="recent-protocols">
                    <h4>Recently Created Protocols</h4>
                    {medicationGroups.slice(0, 5).length === 0 ? (
                      <p>No protocols created yet.</p>
                    ) : (
                      <div className="protocols-list-mini">
                        {medicationGroups.slice(0, 5).map(group => (
                          <div key={group.groupId} className="protocol-item-mini">
                            <strong>{group.groupName}</strong>
                            <span>{group.drugCount || 0} medications</span>
                            <button 
                              onClick={() => {
                                setSelectedGroupDetails(group);
                                setShowGroupDetailsModal(true);
                              }}
                              className="view-protocol-btn"
                            >
                              View
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="protocols-actions">
                    <button onClick={openAddGroupModal} className="create-protocol-btn">
                      ➕ Create New Protocol
                    </button>
                    <button onClick={loadMedicationGroups} className="refresh-protocols-btn">
                      🔄 Refresh Protocols
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit User Modal */}
      {showAddUserModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingUser ? '✏️ Edit User' : '➕ Add New User'}</h2>
              <button className="close-button" onClick={closeAddUserModal}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Username *</label>
                <input
                  type="text"
                  value={editingUser ? editingUser.UserName : newUserData.username}
                  onChange={(e) => handleUserInputChange('username', e.target.value)}
                  placeholder="Enter username"
                  required
                />
              </div>

              <div className="form-group">
                <label>Password {!editingUser && '*'}</label>
                <input
                  type="password"
                  value={editingUser ? editingUser.password || '' : newUserData.password}
                  onChange={(e) => handleUserInputChange('password', e.target.value)}
                  placeholder={editingUser ? "Leave blank to keep current" : "Enter password"}
                  required={!editingUser}
                />
                {editingUser && <small>Leave blank to keep current password</small>}
              </div>

              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  value={editingUser ? editingUser.FullName : newUserData.fullName}
                  onChange={(e) => handleUserInputChange('fullName', e.target.value)}
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Access Level</label>
                <select
                  value={editingUser ? editingUser.AccessLevel : newUserData.accessLevel}
                  onChange={(e) => handleUserInputChange('accessLevel', e.target.value)}
                >
                  <option value="user">User</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={editingUser ? editingUser.IsActive : newUserData.isActive}
                    onChange={(e) => handleUserInputChange('isActive', e.target.checked)}
                  />
                  Active User
                </label>
              </div>

              <div className="modal-actions">
                <button 
                  className="secondary-button" 
                  onClick={closeAddUserModal}
                >
                  Cancel
                </button>

                {editingUser ? (
                  <button 
                    className="primary-button" 
                    onClick={updateUser}
                    disabled={!editingUser.UserName || !editingUser.FullName}
                  >
                    💾 Update User
                  </button>
                ) : (
                  <button 
                    className="primary-button" 
                    onClick={addNewUser}
                    disabled={!newUserData.username || !newUserData.password || !newUserData.fullName}
                  >
                    💾 Add User
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;