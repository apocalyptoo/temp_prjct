import axios from 'axios';
import { getToken } from '../utils/storage';

const API_URL = process.env.API_URL || 'https://demonstrational-nonfatal-judson.ngrok-free.dev';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// request interceptor to add token
api.interceptors.request.use(
  async config => {
    const token = await getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  error => Promise.reject(error)
);

export default api;