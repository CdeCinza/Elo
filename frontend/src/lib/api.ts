import axios from 'axios';
import { getAuthToken, getActiveRestaurant, getAuthUser } from './auth';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? '/api/v1' : 'http://127.0.0.1:8000/api/v1'),
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const activeRestaurant = getActiveRestaurant();
    const user = getAuthUser();
    const restId = activeRestaurant?.id || user?.restaurant_id;
    if (restId) {
      config.headers['X-Restaurant-Id'] = restId.toString();
    }
  }
  return config;
});

