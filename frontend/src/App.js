import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";

import pharmacyLogo from "./assets/logo.png";

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
  const [systemSettings, setSystemSettings] = useState({
    system_enabled: 'true',
    maintenance_mode: 'false', 
    allowed_users: 'all'
  });

  // Custom Drug State
  const [showCustomDrugModal, setShowCustomDrugModal] = useState(false);
  const [customDrugData, setCustomDrugData] = useState({
    drugName: '',
    instructionText: '',
    activeIngredient: '',
    internationalCode: ''
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

  // Generate months (01-12) and years (26-50)
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: (i + 1).toString().padStart(2, "0"),
    label: `${(i + 1).toString().padStart(2, "0")} - ${new Date(2000, i).toLocaleString("en", { month: "long" })}`,
  }));

  const years = Array.from({ length: 25 }, (_, i) => ({
    value: (i + 26).toString(),
    label: `20${(i + 26).toString()}`,
  }));

  // Load medications on startup
  useEffect(() => {
    loadMedications();
    loadLocalAuditLogs();
  }, []);

  // ==================== AUTHENTICATION ====================
  const handleLogin = async (e) => {
    e.preventDefault();
    
    try {
      // 🔐 CHECK 1: See if system is enabled (YOUR KILL SWITCH)
      const { data: settings, error: settingsError } = await supabase
        .from('system_settings')
        .select('*')
        .in('setting_key', ['system_enabled', 'maintenance_mode', 'allowed_users']);
    
      if (settingsError) {
        console.error('Settings error:', settingsError);
        // Continue with login if settings table doesn't exist yet
      } else {
        const systemEnabled = settings?.find(s => s.setting_key === 'system_enabled')?.setting_value === 'true';
        const maintenanceMode = settings?.find(s => s.setting_key === 'maintenance_mode')?.setting_value === 'true';
        const allowedUsers = settings?.find(s => s.setting_key === 'allowed_users')?.setting_value;
    
        // 🚫 SYSTEM DISABLED - Only you (mahmoud_abdelkader) can login
        if (!systemEnabled && loginData.username !== 'mahmoud_abdelkader') {
          alert('🚫 System is currently disabled by administrator. Please try again later.');
          return;
        }
    
        // 🔧 MAINTENANCE MODE - Only you can login
        if (maintenanceMode && loginData.username !== 'mahmoud_abdelkader') {
          alert('🔧 System is in maintenance mode. Only administrators can login.');
          return;
        }
    
        // 👥 RESTRICTED USERS - Only specific users can login
        if (allowedUsers && allowedUsers !== 'all') {
          const allowedList = allowedUsers.split(',').map(u => u.trim());
          if (!allowedList.includes(loginData.username) && loginData.username !== 'mahmoud_abdelkader') {
            alert('🚫 Your account is not currently authorized to access the system.');
            return;
          }
        }
      }
    
      // ✅ CONTINUE NORMAL LOGIN
      const { data: users, error } = await supabase
        .from('tblUsers')
        .select('*')
        .eq('UserName', loginData.username)
        .eq('Password', loginData.password)
        .eq('IsActive', 'true');  // ← Use string 'true' instead of boolean true
    
      if (error || !users || users.length === 0) {
        alert('Invalid username or password');
        return;
      }
    
      const user = users[0];
      setUser({
        id: user.UserID,
        username: user.UserName,
        fullName: user.FullName,
        accessLevel: user.AccessLevel
      });
    
      // Check if admin
      if (user.UserName === "mahmoud_abdelkader" && loginData.password === "12345") {
        setIsAdmin(true);
        alert(`👑 Welcome System Administrator ${user.FullName}! Admin privileges activated.`);
      } else {
        alert(`✅ Welcome ${user.FullName}!`);
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

  // ==================== MEDICATIONS ====================
  const loadMedications = async () => {
    try {
      const { data: medications, error } = await supabase
        .from('tblDrugs')
        .select('*')
        .order('DrugName');

      if (error) throw error;
      
      setMedications(medications || []);
      console.log("Loaded medications from Supabase:", medications.length);
    } catch (error) {
      console.error("Error loading medications:", error);
      setMedications([]);
    }
  };

  const loadSystemSettings = async () => {
    try {
      const { data: settings, error } = await supabase
        .from('system_settings')
        .select('*');
      
      if (!error && settings) {
        const settingsObj = {};
        settings.forEach(setting => {
          settingsObj[setting.setting_key] = setting.setting_value;
        });
        setSystemSettings(settingsObj);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const updateSystemSetting = async (key, value) => {
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ 
          setting_value: value.toString(),
          updated_by: user.username,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', key);

      if (error) throw error;
      
      setSystemSettings(prev => ({ ...prev, [key]: value.toString() }));
      alert('✅ Setting updated successfully!');
    } catch (error) {
      alert('❌ Error updating setting: ' + error.message);
    }
  };

  const filterMedications = (medications, searchTerm) => {
    if (!searchTerm.trim()) return medications;

    const searchText = searchTerm.trim().toLowerCase();

    const filtered = medications.filter((medication) => {
      const drugName = (medication.DrugName || "").toLowerCase();
      const instruction = (medication.Instruction || "").toLowerCase();
      const activeIngredient = (
        medication.active_ingredient || ""
      ).toLowerCase();

      const nameMatch = drugName.includes(searchText);
      const instructionMatch = instruction.includes(searchText);
      const ingredientMatch = activeIngredient.includes(searchText);

      return nameMatch || instructionMatch || ingredientMatch;
    });

    return filtered;
  };

  const createUniqueKey = (medication, index) => {
    return `${medication.DrugName}-${index}-${medication.InternationalCode || ""}`;
  };

  // ==================== BASKET MANAGEMENT ====================
  const loadBasket = () => {
    try {
      const savedBasket = localStorage.getItem('medicationBasket');
      if (savedBasket) {
        const basket = JSON.parse(savedBasket);
        setBasket(basket);
      }
    } catch (error) {
      console.error("Error loading basket:", error);
      setBasket([]);
    }
  };

  const addToBasket = async (medication) => {
    if (!patients) {
      alert("Please search and select a patient first!");
      return;
    }

    const instructionToUse = useCustomInstruction && customInstruction 
      ? customInstruction 
      : medication.Instruction;

    const newItem = {
      TempID: Date.now().toString(),
      DrugName: medication.DrugName,
      InstructionText: instructionToUse,
      printQuantity: 1,
      expiryDate: "",
      expiryMonth: "",
      expiryYear: ""
    };

    const updatedBasket = [...basket, newItem];
    setBasket(updatedBasket);
    localStorage.setItem('medicationBasket', JSON.stringify(updatedBasket));

    if (useCustomInstruction) {
      setCustomInstruction("");
      setUseCustomInstruction(false);
    }

    alert(`Added ${medication.DrugName} to basket`);
  };

  const updateMedicationQuantity = (tempId, quantity) => {
    const newQuantity = Math.max(1, Math.min(10, parseInt(quantity) || 1));

    setBasket((prevBasket) =>
      prevBasket.map((item) =>
        item.TempID === tempId
          ? { ...item, printQuantity: newQuantity }
          : item,
      ),
    );
    
    // Update localStorage
    const updatedBasket = basket.map(item => 
      item.TempID === tempId ? { ...item, printQuantity: newQuantity } : item
    );
    localStorage.setItem('medicationBasket', JSON.stringify(updatedBasket));
  };

  const handleExpiryMonthChange = (tempId, month) => {
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
  };

  const handleExpiryYearChange = (tempId, year) => {
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
  };

  const removeFromBasket = (tempId) => {
    const updatedBasket = basket.filter(item => item.TempID !== tempId);
    setBasket(updatedBasket);
    localStorage.setItem('medicationBasket', JSON.stringify(updatedBasket));
  };

  const clearBasket = () => {
    if (basket.length === 0) {
      alert("Basket is already empty");
      return;
    }

    if (
      window.confirm(
        "Are you sure you want to clear all medications from the basket?",
      )
    ) {
      setBasket([]);
      localStorage.removeItem('medicationBasket');
      alert("Basket cleared successfully");
    }
  };

  // ==================== PATIENT MANAGEMENT ====================
  const searchPatient = async (patientId, year) => {
    if (!patientId || !year) {
      alert("Please enter both Patient ID and Year");
      return;
    }

    try {
      const { data: patient, error } = await supabase
        .from('patients_correct')
        .select('*')
        .eq('PatientID', patientId)
        .eq('Year', year)
        .single();

      if (error || !patient) {
        alert("Patient not found");
        setPatients(null);
        return;
      }

      setPatients({
        ...patient,
        fullId: `${patient.PatientID}/${patient.Year}`
      });
      
    } catch (error) {
      alert("Error searching patient: " + error.message);
      setPatients(null);
    }
  };

  const loadPatientsList = async (page = 1, search = '') => {
    try {
      const from = (page - 1) * 20;
      
      let query = supabase
        .from('patients_correct')
        .select('*', { count: 'exact' });

      if (search) {
        query = query.or(`PatientName.ilike.%${search}%,PatientID.ilike.%${search}%,NationalID.ilike.%${search}%`);
      }

      const { data: patients, error, count } = await query.range(from, from + 19);

      if (error) throw error;

      setPatientsList(patients || []);
      setPatientsPagination({
        page,
        totalPages: Math.ceil(count / 20),
        total: count
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
      const { data, error } = await supabase
        .from('patients_correct')
        .insert([{
          PatientID: newPatientData.patientId,
          Year: newPatientData.year,
          PatientName: newPatientData.patientName,
          NationalID: newPatientData.nationalId || null
        }]);

      if (error) throw error;

      alert('Patient added successfully!');
      closeAddPatientModal();
      loadPatientsList();

      // Set as current patient
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
    if (!editingPatient.patientName) {
      alert('Patient Name is required');
      return;
    }

    try {
      const { error } = await supabase
        .from('patients_correct')
        .update({
          PatientName: editingPatient.PatientName,
          NationalID: editingPatient.NationalID
        })
        .eq('PatientID', editingPatient.PatientID)
        .eq('Year', editingPatient.Year);

      if (error) throw error;

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
      const { error } = await supabase
        .from('patients_correct')
        .delete()
        .eq('PatientID', patient.PatientID)
        .eq('Year', patient.Year);

      if (error) throw error;

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
  const handleCustomDrugInputChange = (field, value) => {
    setCustomDrugData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const openCustomDrugModal = () => {
    setCustomDrugData({
      drugName: '',
      instructionText: '',
      activeIngredient: '',
      internationalCode: ''
    });
    setShowCustomDrugModal(true);
    setAddingToBasket(false);
  };

  const openQuickAddModal = () => {
    setCustomDrugData({
      drugName: '',
      instructionText: '',
      activeIngredient: '',
      internationalCode: ''
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
      internationalCode: ''
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
      const { data, error } = await supabase
        .from('tblDrugs')
        .insert([{
          DrugName: customDrugData.drugName,
          Instruction: customDrugData.instructionText || 'Take as directed',
          active_ingredient: customDrugData.activeIngredient || '',
          InternationalCode: customDrugData.internationalCode || ''
        }]);

      if (error) throw error;

      alert('Custom drug added successfully!');
      await loadMedications();
      await addCustomDrugToBasket(customDrugData.drugName, customDrugData.instructionText);
      closeCustomDrugModal();
    } catch (error) {
      console.error('Error saving custom drug:', error);
      alert('Error saving custom drug: ' + error.message);
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
      await addCustomDrugToBasket(customDrugData.drugName, customDrugData.instructionText);
      closeCustomDrugModal();
    } catch (error) {
      alert('Error adding custom drug to basket: ' + error.message);
    }
  };

  const addCustomDrugToBasket = async (drugName, instructionText) => {
    try {
      const newItem = {
        TempID: Date.now().toString(),
        DrugName: drugName,
        InstructionText: instructionText || 'Take as directed',
        printQuantity: 1,
        expiryDate: "",
        expiryMonth: "",
        expiryYear: ""
      };

      const updatedBasket = [...basket, newItem];
      setBasket(updatedBasket);
      localStorage.setItem('medicationBasket', JSON.stringify(updatedBasket));
      alert(`Added "${drugName}" to basket successfully!`);
    } catch (error) {
      throw new Error('Failed to add to basket: ' + error.message);
    }
  };

  // ==================== ADMIN MANAGEMENT ====================
  const openAdminPanel = async () => {
    setShowAdminPanel(true);
    loadAdminUsers();
    loadAdminStatistics();
    loadRecentActivities();
    loadSystemSettings();
  };

  const closeAdminPanel = () => {
    setShowAdminPanel(false);
    setAdminActiveTab('dashboard');
  };

  const loadAdminUsers = async () => {
    try {
      const { data: users, error } = await supabase
        .from('tblUsers')
        .select('*')
        .order('UserName');

      if (error) throw error;
      setAdminUsers(users || []);
    } catch (error) {
      console.error('Error loading users:', error);
      alert('Error loading users: ' + error.message);
    }
  };

  const loadAdminStatistics = async () => {
    try {
      // Get medications count
      const { count: medicationsCount } = await supabase
        .from('tblDrugs')
        .select('*', { count: 'exact', head: true });

      // Get patients count
      const { count: patientsCount } = await supabase
        .from('patients_correct')
        .select('*', { count: 'exact', head: true });

      // Get users count
      const { count: usersCount } = await supabase
        .from('tblUsers')
        .select('*', { count: 'exact', head: true });

      // Get audit logs count from localStorage
      const auditLogs = JSON.parse(localStorage.getItem("medicationAuditLogs") || "[]");
      const auditLogsCount = auditLogs.length;

      setAdminStatistics({
        medicationsCount: medicationsCount || 0,
        patientsCount: patientsCount || 0,
        usersCount: usersCount || 0,
        auditLogsCount
      });
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const loadRecentActivities = async () => {
    try {
      const auditLogs = JSON.parse(localStorage.getItem("medicationAuditLogs") || "[]");
      // Get recent 20 activities
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
      const { data, error } = await supabase
        .from('tblUsers')
        .insert([{
          UserName: newUserData.username,
          Password: newUserData.password,
          FullName: newUserData.fullName,
          AccessLevel: newUserData.accessLevel,
          IsActive: newUserData.isActive ? 'true' : 'false'
        }]);

      if (error) throw error;

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
    if (!editingUser.username || !editingUser.fullName) {
      alert('Username and Full Name are required');
      return;
    }

    try {
      const updateData = {
        UserName: editingUser.UserName,
        FullName: editingUser.FullName,
        AccessLevel: editingUser.AccessLevel,
        IsActive: editingUser.IsActive ? 'true' : 'false'
      };

      // Only update password if provided
      if (editingUser.password) {
        updateData.Password = editingUser.password;
      }

      const { error } = await supabase
        .from('tblUsers')
        .update(updateData)
        .eq('UserID', editingUser.UserID);

      if (error) throw error;

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
      const { error } = await supabase
        .from('tblUsers')
        .delete()
        .eq('UserID', user.UserID);

      if (error) throw error;

      alert('User deleted successfully!');
      loadAdminUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error deleting user: ' + error.message);
    }
  };

  const canManagePatients = () => {
    return isAdmin || user?.accessLevel === 'manager';
  };

  const canManageDrugs = () => {
    return isAdmin || user?.accessLevel === 'manager';
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
        printQuantity: item.printQuantity || 1,
        status: "printed",
      }));

      const existingLogs = JSON.parse(
        localStorage.getItem("medicationAuditLogs") || "[]",
      );
      const updatedLogs = [...existingLogs, ...localAuditEntries];
      localStorage.setItem("medicationAuditLogs", JSON.stringify(updatedLogs));

      console.log(
        "✅ Saved to local audit:",
        localAuditEntries.length,
        "entries",
      );
      setAuditLogs(updatedLogs);

      return localAuditEntries;
    } catch (error) {
      console.error("Error saving to local audit:", error);
      return [];
    }
  };

  const loadLocalAuditLogs = () => {
    try {
      const logs = JSON.parse(
        localStorage.getItem("medicationAuditLogs") || "[]",
      );
      setAuditLogs(logs);
      console.log("📊 Loaded local audit logs:", logs.length);
    } catch (error) {
      console.error("Error loading local audit logs:", error);
    }
  };

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
        "Quantity",
        "Printed By",
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
            `"${log.expiryDate || "N/A"}"`,
            `"${log.printQuantity}"`,
            `"${log.printedBy}"`,
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
        let displayExpiry = item.expiryDate;
        if (item.expiryDate && item.expiryDate.includes("/")) {
          const [month, year] = item.expiryDate.split("/");
          displayExpiry = `${month}/20${year}`;
        }

        labelsHTML += `
            <div class="label-container">
              <div class="label-content">
                <div class="label-header">
                  <div class="logo-container">
                    <img src="${logoUrl}" alt="Pharmacy Logo" class="logo-image" onerror="this.style.display='none'" />
                  </div>
                  <div class="patient-id">
                    M.R.N: ${patients.fullId}
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
                    <span>Exp: ${displayExpiry}</span>
                    <span>By: Dr Mahmoud</span>
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
              height: 0.6cm;
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding-bottom: 0.2mm;
              border-bottom: 1px solid #000;
            }

            .logo-container {
              flex: 1;
              display: flex;
              align-items: center;
            }

            .logo-image {
              max-height: 0.6cm !important;
              max-width: 90% !important;
              width: auto;
              object-fit: contain;
            }

            .patient-id {
              flex: 1;
              text-align: right;
              font-size: 7pt;
              font-weight: bold;
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
              min-height: 0.85cm;
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
              height: 0.3cm;
              font-size: 3.5pt;
              font-weight: bold;
              display: flex;
              flex-direction: column;
              justify-content: space.000000-1b121et11ween;
              padding-top: 0.1mm;
            }

            .footer-line {
              display: flex;
              justify-content: space-between;
            }

            .footer-date {
              text-align: center;
              font-weight: bold;
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

    const medicationsWithoutExpiry = basket.filter((item) => !item.expiryDate);
    if (medicationsWithoutExpiry.length > 0) {
      const missingItems = medicationsWithoutExpiry
        .map((item) => item.DrugName)
        .join(", ");
      alert(
        `Please enter expiry dates for all medications in the basket.\n\nMissing expiry dates for: ${missingItems}`,
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
      setBasket([]);
      localStorage.removeItem('medicationBasket');
      alert("Labels printed successfully!");
    } catch (error) {
      console.error("Print error:", error);
      alert(
        "Print completed, but there was an issue with audit logging. Check console for details.",
      );
    }
  };

  // ==================== RENDER LOGIC ====================
  const filteredMedications = filterMedications(medications, searchTerm);
  const totalLabelsCount = basket.reduce(
    (total, item) => total + (item.printQuantity || 1),
    0,
  );

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
                  <h3>✅ Patient Found</h3>
                  <p>
                    <strong>Name:</strong> {patients.PatientName}
                  </p>
                  <p>
                    <strong>ID:</strong> {patients.fullId}
                  </p>
                  <p>
                    <strong>National ID:</strong> {patients.NationalID}
                  </p>
                </div>
              )}
            </div>

            {/* Medications List */}
            <div className="section medications-section">
              <h2>💊 Available Medications ({medications.length})</h2>

              {/* Search Box */}
              <input
                type="text"
                placeholder="ابحث باسم الدواء..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
                style={{ textAlign: "right" }}
              />

              {/* Enhanced Custom Drug & Patient Management Buttons */}
              <div className="custom-drug-buttons" style={{ margin: '10px 0', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>

                {/* Show drug management buttons only to authorized users */}
                {(isAdmin || canManageDrugs()) && (
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

                {/* Show patient management button only to authorized users */}
                {(isAdmin || canManagePatients()) && (
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
                {isAdmin && (
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
                  {filteredMedications.length} medications found for "
                  {searchTerm}"
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

              {/* Medications List */}
              <div className="medications-list">
                {filteredMedications.length === 0 && searchTerm ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "20px",
                      color: "#666",
                    }}
                  >
                    No medications found for "{searchTerm}"
                  </div>
                ) : (
                  filteredMedications.map((medication, index) => (
                    <div
                      key={createUniqueKey(medication, index)}
                      className="medication-item"
                    >
                      <div className="medication-info">
                        <strong>{medication.DrugName}</strong>
                        <p>{medication.Instruction}</p>
                        {medication.active_ingredient && (
                          <small style={{ color: "#666", fontStyle: "italic" }}>
                            المادة الفعالة: {medication.active_ingredient}
                          </small>
                        )}
                        {medication.InternationalCode && (
                          <small>Barcode: {medication.InternationalCode}</small>
                        )}
                      </div>
                      <button
                        onClick={() => addToBasket(medication)}
                        disabled={!patients}
                      >
                        Add to Basket
                      </button>
                    </div>
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
                    <div key={item.TempID} className="basket-item">
                      <div className="basket-info">
                        <strong>{item.DrugName}</strong>
                        <p>{item.InstructionText}</p>

                        {/* Quantity Selector */}
                        <div className="quantity-input">
                          <label>Number of Labels:</label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={item.printQuantity || 1}
                            onChange={(e) =>
                              updateMedicationQuantity(
                                item.TempID,
                                e.target.value,
                              )
                            }
                            style={{
                              width: "60px",
                              marginLeft: "10px",
                              padding: "5px",
                            }}
                          />
                        </div>

                        {/* Expiry Date Selector */}
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
                              onChange={(e) =>
                                handleExpiryMonthChange(
                                  item.TempID,
                                  e.target.value,
                                )
                              }
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
                              onChange={(e) =>
                                handleExpiryYearChange(
                                  item.TempID,
                                  e.target.value,
                                )
                              }
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
                      </div>
                      <button
                        onClick={() => removeFromBasket(item.TempID)}
                        className="remove-btn"
                      >
                        ❌
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Basket Controls */}
              {basket.length > 0 && (
                <div className="basket-controls">
                  <button onClick={clearBasket} className="clear-btn">
                    Clear Basket
                  </button>
                </div>
              )}
            </div>

            {/* Print Controls */}
            {patients && basket.length > 0 && (
              <div className="section print-section">
                <h2>🖨️ Print Labels</h2>

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
                        color: basket.some((item) => !item.expiryDate)
                          ? "red"
                          : "green",
                      }}
                    >
                      Expiry Dates:{" "}
                      {basket.filter((item) => item.expiryDate).length}/
                      {basket.length} set
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
                        <th>Quantity</th>
                        <th>Printed By</th>
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
                            <td>{log.expiryDate || "N/A"}</td>
                            <td>{log.printQuantity}</td>
                            <td>{log.printedBy}</td>
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
              </div>

              {/* Dashboard Tab */}
              {adminActiveTab === "dashboard" && (
                <div className="admin-dashboard">
                  <h3>System Overview</h3>
                  
                  {/* SYSTEM ACCESS CONTROL PANEL */}
                  <div className="system-controls" style={{border: '2px solid #dc3545', padding: '15px', borderRadius: '8px', margin: '10px 0', background: '#fff5f5'}}>
                    <h3>🔐 SYSTEM ACCESS CONTROL</h3>
                    <p style={{color: '#dc3545', fontSize: '14px'}}>Control who can access the system</p>
                    
                    <div style={{margin: '15px 0'}}>
                      <label style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                        <input
                          type="checkbox"
                          checked={systemSettings.system_enabled === 'true'}
                          onChange={(e) => updateSystemSetting('system_enabled', e.target.checked)}
                        />
                        <span style={{fontWeight: 'bold', color: systemSettings.system_enabled === 'true' ? 'green' : 'red'}}>
                          {systemSettings.system_enabled === 'true' ? '✅ SYSTEM ENABLED' : '🚫 SYSTEM DISABLED'}
                        </span>
                      </label>
                      <small style={{display: 'block', marginLeft: '30px', color: '#666'}}>
                        Master switch - when disabled, only you (mahmoud_abdelkader) can login
                      </small>
                    </div>
                  
                    <div style={{margin: '15px 0'}}>
                      <label style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                        <input
                          type="checkbox"
                          checked={systemSettings.maintenance_mode === 'true'}
                          onChange={(e) => updateSystemSetting('maintenance_mode', e.target.checked)}
                        />
                        <span style={{fontWeight: 'bold', color: systemSettings.maintenance_mode === 'true' ? 'orange' : 'green'}}>
                          {systemSettings.maintenance_mode === 'true' ? '🔧 MAINTENANCE MODE' : '✅ NORMAL MODE'}
                        </span>
                      </label>
                      <small style={{display: 'block', marginLeft: '30px', color: '#666'}}>
                        When enabled, only administrators can login
                      </small>
                    </div>
                  
                    <div style={{margin: '15px 0'}}>
                      <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Allowed Users:</label>
                      <input
                        type="text"
                        value={systemSettings.allowed_users}
                        onChange={(e) => updateSystemSetting('allowed_users', e.target.value)}
                        placeholder="all or comma-separated usernames"
                        style={{width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px'}}
                      />
                      <small style={{color: '#666'}}>
                        Enter "all" to allow everyone, or specific usernames like "user1,user2,user3"
                      </small>
                    </div>
                  
                    <div style={{marginTop: '20px', padding: '10px', background: '#f8f9fa', borderRadius: '5px'}}>
                      <h4>Quick Actions:</h4>
                      <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                        <button 
                          onClick={() => updateSystemSetting('system_enabled', false)}
                          style={{padding: '8px 12px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
                        >
                          🚫 Disable System for Everyone
                        </button>
                        <button 
                          onClick={() => updateSystemSetting('system_enabled', true)}
                          style={{padding: '8px 12px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
                        >
                          ✅ Enable System for Everyone
                        </button>
                        <button 
                          onClick={() => {
                            updateSystemSetting('maintenance_mode', true);
                            updateSystemSetting('allowed_users', 'mahmoud_abdelkader');
                          }}
                          style={{padding: '8px 12px', background: '#fd7e14', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
                        >
                          🔧 Enter Maintenance Mode
                        </button>
                      </div>
                    </div>
                  </div>

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
                            </tr>
                          </thead>
                          <tbody>
                            {recentActivities.map((activity, index) => (
                              <tr key={index} className={index % 2 === 0 ? 'even' : 'odd'}>
                                <td>{new Date(activity.timestamp).toLocaleString()}</td>
                                <td>{activity.patientName}</td>
                                <td>{activity.drugName}</td>
                                <td>{activity.printedBy}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
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