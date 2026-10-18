import { apiRequest } from './ApiClient';
// Preserve the interface used by summary and rich-text editor components.
export const AIChatSession = {
  async sendMessage(prompt, format = 'json') {
    const result = await apiRequest('ai', { method: 'POST', data: { prompt, format } });
    return { response: { text: () => result.data.text } };
  },
};
