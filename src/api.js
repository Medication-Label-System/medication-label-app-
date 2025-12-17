// Create a new file: api.js or add this to your app
const API_BASE_URL = "https://tbvbwxszajeqqvnwvlbq.supabase.co"; 

const api = {
  // Authentication
  auth: {
    login: async (username, password) => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        return await response.json();
      } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: error.message };
      }
    }
  },

  // Medications
  medications: {
    getAll: async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/medications`);
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error loading medications:', error);
        return [];
      }
    },

    addCustom: async (drugName, instructionText, activeIngredient, internationalCode, requiresExpiryDate) => {
      try {
        const response = await fetch(`${API_BASE_URL}/medications/custom`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            drugName,
            instructionText,
            activeIngredient,
            internationalCode,
            requiresExpiryDate
          })
        });
        return await response.json();
      } catch (error) {
        console.error('Error adding custom drug:', error);
        return { success: false, message: error.message };
      }
    }
  },

  // Patients
  patients: {
    search: async (patientId, year) => {
      try {
        const response = await fetch(`${API_BASE_URL}/patients/search?patientId=${patientId}&year=${year}`);
        return await response.json();
      } catch (error) {
        console.error('Error searching patient:', error);
        return { success: false, message: error.message };
      }
    },

    getAll: async (page = 1, limit = 20, search = '') => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/patients?page=${page}&limit=${limit}&search=${search}`
        );
        return await response.json();
      } catch (error) {
        console.error('Error loading patients:', error);
        return { patients: [], total: 0, page: 1, totalPages: 1 };
      }
    },

    add: async (patientId, year, patientName, nationalId) => {
      try {
        const response = await fetch(`${API_BASE_URL}/patients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientId, year, patientName, nationalId })
        });
        return await response.json();
      } catch (error) {
        console.error('Error adding patient:', error);
        return { success: false, message: error.message };
      }
    },

    update: async (patientId, year, patientName, nationalId) => {
      try {
        const response = await fetch(`${API_BASE_URL}/patients/${patientId}/${year}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientName, nationalId })
        });
        return await response.json();
      } catch (error) {
        console.error('Error updating patient:', error);
        return { success: false, message: error.message };
      }
    },

    delete: async (patientId, year) => {
      try {
        const response = await fetch(`${API_BASE_URL}/patients/${patientId}/${year}`, {
          method: 'DELETE'
        });
        return await response.json();
      } catch (error) {
        console.error('Error deleting patient:', error);
        return { success: false, message: error.message };
      }
    }
  },

  // Admin
  admin: {
    getUsers: async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/admin/users`);
        return await response.json();
      } catch (error) {
        console.error('Error loading users:', error);
        return [];
      }
    },

    addUser: async (username, password, fullName, accessLevel, isActive) => {
      try {
        const response = await fetch(`${API_BASE_URL}/admin/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, fullName, accessLevel, isActive })
        });
        return await response.json();
      } catch (error) {
        console.error('Error adding user:', error);
        return { success: false, message: error.message };
      }
    },

    updateUser: async (userId, username, fullName, accessLevel, isActive, password) => {
      try {
        const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, fullName, accessLevel, isActive, password })
        });
        return await response.json();
      } catch (error) {
        console.error('Error updating user:', error);
        return { success: false, message: error.message };
      }
    },

    deleteUser: async (userId) => {
      try {
        const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
          method: 'DELETE'
        });
        return await response.json();
      } catch (error) {
        console.error('Error deleting user:', error);
        return { success: false, message: error.message };
      }
    },

    getStatistics: async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/admin/statistics`);
        return await response.json();
      } catch (error) {
        console.error('Error loading statistics:', error);
        return {};
      }
    }
  },

  // Medication Groups
  medicationGroups: {
    getAll: async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/medication-groups`);
        return await response.json();
      } catch (error) {
        console.error('Error loading medication groups:', error);
        return [];
      }
    },

    getDetails: async (groupId) => {
      try {
        const response = await fetch(`${API_BASE_URL}/medication-groups/${groupId}`);
        return await response.json();
      } catch (error) {
        console.error('Error loading group details:', error);
        return null;
      }
    },

    create: async (groupName, description, drugs) => {
      try {
        const response = await fetch(`${API_BASE_URL}/medication-groups`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupName, description, drugs })
        });
        return await response.json();
      } catch (error) {
        console.error('Error creating group:', error);
        return { success: false, message: error.message };
      }
    },

    update: async (groupId, groupName, description, drugs) => {
      try {
        const response = await fetch(`${API_BASE_URL}/medication-groups/${groupId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupName, description, drugs })
        });
        return await response.json();
      } catch (error) {
        console.error('Error updating group:', error);
        return { success: false, message: error.message };
      }
    },

    delete: async (groupId) => {
      try {
        const response = await fetch(`${API_BASE_URL}/medication-groups/${groupId}`, {
          method: 'DELETE'
        });
        return await response.json();
      } catch (error) {
        console.error('Error deleting group:', error);
        return { success: false, message: error.message };
      }
    }
  }
};

export default api;