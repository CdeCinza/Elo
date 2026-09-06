import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? '/api/v1' : 'http://127.0.0.1:8000/api/v1'),
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});
