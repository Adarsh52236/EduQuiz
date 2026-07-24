// API utility functions for making authenticated requests
import { API_BASE_URL } from '@/config/api';

/**
 * Makes an authenticated API request with the user's token
 * @param {string} url - The API endpoint URL
 * @param {object} options - Request options (method, headers, body, etc.)
 * @returns {Promise<any>} - The JSON response data
 */
export async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('token');
  
  // Prepend base URL if url is relative
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Network error' }));
    throw new Error(errorData.message || `API call failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Makes a POST request with authentication
 * @param {string} url - The API endpoint URL
 * @param {object} data - The request body data
 * @param {object} options - Additional request options
 * @returns {Promise<any>} - The JSON response data
 */
export async function postWithAuth(url, data, options = {}) {
  return fetchWithAuth(url, {
    method: 'POST',
    body: JSON.stringify(data),
    ...options,
  });
}

/**
 * Makes a PUT request with authentication
 * @param {string} url - The API endpoint URL
 * @param {object} data - The request body data
 * @param {object} options - Additional request options
 * @returns {Promise<any>} - The JSON response data
 */
export async function putWithAuth(url, data, options = {}) {
  return fetchWithAuth(url, {
    method: 'PUT',
    body: JSON.stringify(data),
    ...options,
  });
}

/**
 * Makes a DELETE request with authentication
 * @param {string} url - The API endpoint URL
 * @param {object} options - Additional request options
 * @returns {Promise<any>} - The JSON response data
 */
export async function deleteWithAuth(url, options = {}) {
  return fetchWithAuth(url, {
    method: 'DELETE',
    ...options,
  });
}

/**
 * Handles API errors and provides user-friendly messages
 * @param {Error} error - The error object
 * @returns {string} - User-friendly error message
 */
export function handleApiError(error) {
  if (error.message.includes('Network error')) {
    return 'Unable to connect to the server. Please check your internet connection.';
  }
  if (error.message.includes('401')) {
    return 'Your session has expired. Please log in again.';
  }
  if (error.message.includes('403')) {
    return 'You don\'t have permission to perform this action.';
  }
  if (error.message.includes('404')) {
    return 'The requested resource was not found.';
  }
  if (error.message.includes('422')) {
    return 'Invalid data provided. Please check your input.';
  }
  return error.message || 'An unexpected error occurred. Please try again.';
}

/**
 * Checks if the user is authenticated by verifying token existence
 * @returns {boolean} - True if user has a valid token
 */
export function isAuthenticated() {
  const token = localStorage.getItem('token');
  return !!token;
}

/**
 * Clears authentication data and redirects to login
 */
export function logoutAndRedirect() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}