import axios from 'axios';

// ─── API Versioning ────────────────────────────────────────────────────────────
// Change this single constant to update ALL endpoint paths at once (e.g., '/api/v2')
export const API_BASE = '/api/v1';

const api = axios.create({
  baseURL: '/',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
  withCredentials: true, // Required to send session cookies with every request
});

// ─── Response interceptors ────────────────────────────────────────────────────

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // If session expired or not authenticated, redirect to login
    if (err.response?.status === 401) {
      const isMeCall = err.config?.url?.includes(`${API_BASE}/auth/me`);
      const isPublicPath = typeof window !== 'undefined' && (
        window.location.pathname.startsWith('/login') || 
        window.location.pathname.startsWith('/user-login') || 
        window.location.pathname.startsWith('/user-register')
      );
      
      if (!isMeCall && !isPublicPath) {
        if (typeof window !== 'undefined') {
          if (window.location.pathname.startsWith('/publish')) {
            window.location.href = `/user-login?expired=1&redirect=${encodeURIComponent(window.location.pathname)}`;
          } else {
            window.location.href = '/login?expired=1';
          }
        }
      }
    }
    const msg =
      err.response?.data?.message ||
      err.response?.data?.error ||
      err.response?.data ||
      err.message ||
      'Network Error';
    return Promise.reject(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)));
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login:        (email, password)       => api.post(`${API_BASE}/admin/auth/login`, { email, password }),
  register:     (name, email, password) => api.post(`${API_BASE}/admin/auth/register`, { name, email, password }),
  userLogin:    (email, password)       => api.post(`${API_BASE}/auth/login`, { email, password }),
  userRegister: (name, email, password) => api.post(`${API_BASE}/auth/register`, { name, email, password }),
  logout:       ()                      => api.post(`${API_BASE}/auth/logout`),
  me:           ()                      => api.get(`${API_BASE}/auth/me`),
};

export const userApi = {
  updateSettings: (data) => api.put(`${API_BASE}/admin/user/settings`, data),
};

// ─── Forms (admin) ────────────────────────────────────────────────────────────
// Admin endpoints are prefixed with /admin for RBAC protection
export const formsApi = {
  getAll:      ()                     => api.get(`${API_BASE}/admin/forms`),
  getStats:    ()                     => api.get(`${API_BASE}/admin/forms/stats`),
  getById:     (id)                   => api.get(`${API_BASE}/admin/forms/${id}`),
  create:      (data)                 => api.post(`${API_BASE}/admin/forms`, data),
  update:      (id, data)             => api.put(`${API_BASE}/admin/forms/${id}`, data),
  getStatus:   (id)                   => api.get(`${API_BASE}/publish/${id}/status`),
  publish:     (id, data = {})        => api.post(`${API_BASE}/admin/forms/${id}/publish`, data),
  delete:      (id)                   => api.delete(`${API_BASE}/admin/forms/${id}`),
  getTrashForms: ()                   => api.get(`${API_BASE}/admin/forms/trash`),
  recoverForm: (id)                   => api.post(`${API_BASE}/admin/forms/${id}/recover`),

  // Fields
  getFields:    (id)                  => api.get(`${API_BASE}/admin/forms/${id}/fields`),
  addField:     (id, data)            => api.post(`${API_BASE}/admin/forms/${id}/fields`, data),
  updateField:  (id, fieldId, data)   => api.put(`${API_BASE}/admin/forms/${id}/fields/${fieldId}`, data),
  deleteField:  (id, fieldId)         => api.delete(`${API_BASE}/admin/forms/${id}/fields/${fieldId}`),
  reorderFields:(id, orders)          => api.put(`${API_BASE}/admin/forms/${id}/fields/reorder`, orders),

  // Public endpoints — no auth required
  getPublished:         (id)                      => api.get(`${API_BASE}/publish/${id}/published`),
  getPublicResponse:    (id, responseId)           => api.get(`${API_BASE}/publish/${id}/submissions/${responseId}`),
  updatePublicResponse: (id, responseId, data)     => api.put(`${API_BASE}/publish/${id}/submissions/${responseId}`, data),

  // Submissions (admin managed)
  submit:         (id, data, status = 'COMPLETED') => api.post(`${API_BASE}/publish/${id}/submit`, { ...data, status }),
  getDraft:       (id)                => api.get(`${API_BASE}/publish/${id}/draft`),
  saveDraft:      (id, data)          => api.post(`${API_BASE}/publish/${id}/submit`, { ...data, status: 'DRAFT' }),
  getResponses:   (id)                => api.get(`${API_BASE}/admin/forms/${id}/submissions`),
  getTrashSubmissions: (id)           => api.get(`${API_BASE}/admin/forms/${id}/submissions/trash`),
  getResponseCount:(id)               => api.get(`${API_BASE}/admin/forms/${id}/submissions/count`),
  updateResponse: (id, responseId, data) => api.put(`${API_BASE}/admin/forms/${id}/submissions/${responseId}`, data),
  recoverSubmission: (id, responseId) => api.post(`${API_BASE}/admin/forms/${id}/submissions/${responseId}/recover`),
  deleteResponse: (id, responseId)    => api.delete(`${API_BASE}/admin/forms/${id}/submissions/${responseId}`),
  exportResponses: (id, ids)          => {
    const params = ids && ids.length > 0 ? { ids: ids.join(',') } : {};
    return api.get(`${API_BASE}/admin/forms/${id}/export`, { params, responseType: 'blob' });
  },

  // Bulk Operations
  bulkDeleteForms:      (ids)           => api.delete(`${API_BASE}/admin/forms/bulk`, { data: ids }),
  bulkRecoverForms:     (ids)           => api.post(`${API_BASE}/admin/forms/bulk/recover`, ids),
  bulkDeleteResponses:  (formId, ids)   => api.delete(`${API_BASE}/admin/forms/${formId}/submissions/bulk`, { data: ids }),
  bulkRecoverResponses: (formId, ids)   => api.post(`${API_BASE}/admin/forms/${formId}/submissions/bulk/recover`, ids),

  // Versions
  getVersions:           (formId)      => api.get(`${API_BASE}/admin/versions/form/${formId}`),
  activateVersion:       (versionId)   => api.post(`${API_BASE}/admin/versions/${versionId}/activate`),
  getVersionSubmissions: (versionId)   => api.get(`${API_BASE}/admin/versions/${versionId}/submissions`),
  getVersionFields:      (versionId)   => api.get(`${API_BASE}/admin/versions/${versionId}/fields`),

  // Dynamic Options
  getDynamicOptions:       (formId, fieldKey) => api.get(`${API_BASE}/admin/forms/${formId}/fields/${fieldKey}/options`),
  getPublicDynamicOptions: (formId, fieldKey) => api.get(`${API_BASE}/publish/${formId}/fields/${fieldKey}/options`),

  // Files
  uploadFile:  (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`${API_BASE}/files/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getDownloadUrl: (fileName, dName) => {
    let url = `${API_BASE}/files/download/${fileName}`;
    if (dName) url += `?dName=${encodeURIComponent(dName)}`;
    return url;
  },
};

export const metadataApi = {
  getTables:  ()            => api.get(`${API_BASE}/admin/metadata/tables`),
  getColumns: (tableName)   => api.get(`${API_BASE}/admin/metadata/columns?tableName=${tableName}`),
};

// ─── Business Rules ────────────────────────────────────────────────────────────
export const rulesApi = {
  getRules:       (formId)               => api.get(`${API_BASE}/admin/forms/${formId}/rules`),
  getPublicRules: (formId)               => api.get(`${API_BASE}/publish/${formId}/rules`),
  createRule:     (formId, rule)         => api.post(`${API_BASE}/admin/forms/${formId}/rules`, rule),
  updateRule:     (formId, ruleId, rule) => api.put(`${API_BASE}/admin/forms/${formId}/rules/${ruleId}`, rule),
  deleteRule:     (formId, ruleId)       => api.delete(`${API_BASE}/admin/forms/${formId}/rules/${ruleId}`),
  testRules:      (formId, sampleData)   => api.post(`${API_BASE}/admin/forms/${formId}/rules/test`, sampleData),
};

export default api;
