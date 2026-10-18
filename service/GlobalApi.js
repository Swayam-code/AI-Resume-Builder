import { apiRequest } from './ApiClient';
const CreateNewResume = (data) => apiRequest('resumes', { method: 'POST', data });
const GetUserResumes = () => apiRequest('resumes');
const UpdateResumeDetail = (id, data) => apiRequest(`resumes/${encodeURIComponent(id)}`, { method: 'PUT', data });
const GetResumeById = (id) => apiRequest(`resumes/${encodeURIComponent(id)}`);
const DeleteResumeById = (id) => apiRequest(`resumes/${encodeURIComponent(id)}`, { method: 'DELETE' });
export default { CreateNewResume, GetUserResumes, UpdateResumeDetail, GetResumeById, DeleteResumeById };
