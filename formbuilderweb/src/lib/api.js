import axios from 'axios';

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
      const isMeCall = err.config?.url?.includes('/api/auth/me');
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
  login:    (email, password) => api.post('/admin/api/auth/login', { email, password }),
  register: (name, email, password) => api.post('/admin/api/auth/register', { name, email, password }),
  userLogin: (email, password) => api.post('/api/auth/login', { email, password }),
  userRegister: (name, email, password) => api.post('/api/auth/register', { name, email, password }),
  logout:   () => api.post('/api/auth/logout'),
  me:       () => api.get('/api/auth/me'),
};

export const userApi = {
  updateSettings: (data) => api.put('/admin/api/user/settings', data),
};

// ─── Forms (admin) ────────────────────────────────────────────────────────────
// Admin endpoints are prefixed with /admin/api for RBAC protection
export const formsApi = {
  getAll:      ()                     => api.get('/admin/api/forms'),
  getStats:    ()                     => api.get('/admin/api/forms/stats'),
  getById:     (id)                   => api.get(`/admin/api/forms/${id}`),
  create:      (data)                 => api.post('/admin/api/forms', data),
  update:      (id, data)             => api.put(`/admin/api/forms/${id}`, data),
  getStatus:   (id)                   => api.get(`/publish/${id}/status`),
  publish:     (id, data = {})         => api.post(`/admin/api/forms/${id}/publish`, data),
  delete:      (id)                   => api.delete(`/admin/api/forms/${id}`),
  getTrashForms: ()                   => api.get('/admin/api/forms/trash'),
  recoverForm: (id)                   => api.post(`/admin/api/forms/${id}/recover`),

  // Fields
  getFields:    (id)                  => api.get(`/admin/api/forms/${id}/fields`),
  addField:     (id, data)            => api.post(`/admin/api/forms/${id}/fields`, data),
  updateField:  (id, fieldId, data)   => api.put(`/admin/api/forms/${id}/fields/${fieldId}`, data),
  deleteField:  (id, fieldId)         => api.delete(`/admin/api/forms/${id}/fields/${fieldId}`),
  reorderFields:(id, orders)          => api.put(`/admin/api/forms/${id}/fields/reorder`, orders),

  // Public endpoints are prefixed with /publish (no auth required)
  getPublished: (id) => api.get(`/publish/${id}/published`),
  getPublicResponse: (id, responseId) => api.get(`/publish/${id}/submissions/${responseId}`),
  updatePublicResponse: (id, responseId, data) => api.put(`/publish/${id}/submissions/${responseId}`, data),

  // Submissions (admin managed)
  submit:         (id, data, status = 'COMPLETED') => api.post(`/publish/${id}/submit`, { ...data, status }),
  getDraft:       (id)                => api.get(`/publish/${id}/draft`),
  saveDraft:      (id, data)          => api.post(`/publish/${id}/submit`, { ...data, status: 'DRAFT' }),
  getResponses:   (id)                => api.get(`/admin/api/forms/${id}/submissions`),
  getTrashSubmissions: (id)            => api.get(`/admin/api/forms/${id}/submissions/trash`),
  getResponseCount:(id)               => api.get(`/admin/api/forms/${id}/submissions/count`),
  updateResponse: (id, responseId, data) => api.put(`/admin/api/forms/${id}/submissions/${responseId}`, data),
  recoverSubmission: (id, responseId) => api.post(`/admin/api/forms/${id}/submissions/${responseId}/recover`),
  deleteResponse: (id, responseId)    => api.delete(`/admin/api/forms/${id}/submissions/${responseId}`),
  exportResponses: (id, ids)          => {
    const params = ids && ids.length > 0 ? { ids: ids.join(',') } : {};
    return api.get(`/admin/api/forms/${id}/export`, { params, responseType: 'blob' });
  },

  // Bulk Operations
  bulkDeleteForms: (ids) => api.delete('/admin/api/forms/bulk', { data: ids }),
  bulkRecoverForms: (ids) => api.post('/admin/api/forms/bulk/recover', ids),
  bulkDeleteResponses: (formId, ids) => api.delete(`/admin/api/forms/${formId}/submissions/bulk`, { data: ids }),
  bulkRecoverResponses: (formId, ids) => api.post(`/admin/api/forms/${formId}/submissions/bulk/recover`, ids),

  // Versions
  getVersions: (formId) => api.get(`/admin/api/versions/form/${formId}`),
  activateVersion: (versionId) => api.post(`/admin/api/versions/${versionId}/activate`),
  getVersionSubmissions: (versionId) => api.get(`/admin/api/versions/${versionId}/submissions`),
  getVersionFields: (versionId) => api.get(`/admin/api/versions/${versionId}/fields`),

  // Dynamic Options
  getDynamicOptions: (formId, fieldKey) => api.get(`/admin/api/forms/${formId}/fields/${fieldKey}/options`),
  getPublicDynamicOptions: (formId, fieldKey) => api.get(`/publish/${formId}/fields/${fieldKey}/options`),

  // Files
  uploadFile:  (file)                 => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getDownloadUrl: (fileName, dName) => {
    let url = `/api/files/download/${fileName}`;
    if (dName) url += `?dName=${encodeURIComponent(dName)}`;
    return url;
  },
};

export const metadataApi = {
  getTables: () => api.get('/admin/api/metadata/tables'),
  getColumns: (tableName) => api.get(`/admin/api/metadata/columns?tableName=${tableName}`),
};

// ─── Business Rules (Drools) ──────────────────────────────────────────────────
export const rulesApi = {
  getRules:    (formId)               => api.get(`/admin/api/forms/${formId}/rules`),
  getPublicRules: (formId)            => api.get(`/publish/${formId}/rules`),
  createRule:  (formId, rule)         => api.post(`/admin/api/forms/${formId}/rules`, rule),
  updateRule:  (formId, ruleId, rule) => api.put(`/admin/api/forms/${formId}/rules/${ruleId}`, rule),
  deleteRule:  (formId, ruleId)       => api.delete(`/admin/api/forms/${formId}/rules/${ruleId}`),
  testRules:   (formId, sampleData)   => api.post(`/admin/api/forms/${formId}/rules/test`, sampleData),
};

export default api;
