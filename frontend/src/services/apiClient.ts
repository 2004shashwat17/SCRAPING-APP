/**
 * API client configuration and utilities for communicating with the FastAPI backend
 */

// Determine API base URL with sensible defaults for development.
// Behavior:
// - In development, prefer a localhost backend (`http://localhost:5001`).
//   If `API_BASE_URL` is set in localStorage and points to localhost/127.0.0.1, use that instead.
// - In production, allow an explicit localStorage override or the `REACT_APP_BACKEND_URL` env var.
const getApiBaseUrl = () => {
  // Development: prefer local backend to avoid accidentally calling deployed hosts
  if (process.env.NODE_ENV === 'development') {
    try {
      const overrideUrl = localStorage.getItem('API_BASE_URL');
      if (overrideUrl && (overrideUrl.includes('localhost') || overrideUrl.includes('127.0.0.1'))) {
        return overrideUrl;
      }
    } catch (e) {
      // ignore any localStorage access errors
    }
    return 'http://localhost:5001';
  }

  // Non-development (production/staging): allow override via localStorage first
  try {
    const overrideUrl = localStorage.getItem('API_BASE_URL');
    if (overrideUrl) return overrideUrl;
  } catch (e) {
    // ignore
  }

  if (process.env.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL;
  }

  throw new Error('REACT_APP_BACKEND_URL is not set in the environment variables.');
};

const API_BASE_URL = getApiBaseUrl();

// Utility function to override API URL (for development)
export const setApiBaseUrl = (url: string) => {
  localStorage.setItem('API_BASE_URL', url);
  // Reload the page to apply the new URL
  window.location.reload();
};

// Utility function to reset API URL
export const resetApiBaseUrl = () => {
  localStorage.removeItem('API_BASE_URL');
  window.location.reload();
};

interface UserData {
  username: string;
  email: string;
  full_name?: string;
  password: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  avatar?: string;
  is_active: boolean;
}

interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

interface DashboardStats {
  totalPosts: number;
  activeThreats: number;
  trendingTopics: number;
  systemHealth: number;
}

interface ThreatAlert {
  id: number;
  title: string;
  platform: string;
  timeAgo: string;
  severity: string;
}

interface ActivityTrends {
  posts: number[];
  threats: number[];
  trends: number[];
}

class ApiClient {
  private baseURL: string;
  private token: string | null;

  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('access_token');
  }

  setToken(token: string | null): void {
    // Avoid re-dispatching the token-set event if the token hasn't changed
    if (this.token === token) return;
    this.token = token;
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
    // Notify other parts of the app that a token was set/cleared
    try {
      window.dispatchEvent(new Event('auth:token_set'));
    } catch (e) {
      // ignore in non-browser environments
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Normalize URL to avoid duplicate '/api' when baseURL already contains it
    let ep = endpoint;
    try {
      if (this.baseURL.endsWith('/api') && ep.startsWith('/api')) {
        ep = ep.replace(/^\/api/, '');
      }
    } catch (e) {
      // ignore
    }
    const url = `${this.baseURL}${ep}`;
    const config: RequestInit = {
      headers: this.getHeaders(),
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const err: any = new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        err.status = response.status;
        err.data = errorData;
        err.url = url;
        err.statusText = response.statusText;
        throw err;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Authentication endpoints
  async register(userData: UserData): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    // Send as JSON, backend will accept either username or email
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      headers,
      body: JSON.stringify({ username, password }),
    });
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/api/auth/me');
  }

  // List EDA CSV files for the authenticated user
  // (removed) getEdaFiles: EDA listing removed

  async logout(): Promise<{ message: string }> {
    const result = await this.request<{ message: string }>('/api/auth/logout', { method: 'POST' });
    this.setToken(null);
    return result;
  }

  // Posts endpoints
  async getPosts(): Promise<any> {
    return this.request('/posts/');
  }

  // Get summary stats for a specific EDA file
  // (removed) getEdaFile: per-file EDA endpoint removed

  // Dashboard data endpoints
  async getDashboardStats(): Promise<DashboardStats> {
    const data = await this.request<any>('/dashboard/stats');
    return {
      totalPosts: data.total_posts,
      activeThreats: data.active_threats,
      trendingTopics: data.trending_topics,
      systemHealth: data.system_health
    };
  }

  async getThreatAlerts(): Promise<ThreatAlert[]> {
    const data = await this.request<any[]>('/dashboard/threats');
    return data.map(threat => ({
      id: threat.id,
      title: threat.title,
      platform: threat.platform,
      timeAgo: threat.time_ago,
      severity: threat.severity
    }));
  }

  async getActivityTrends(): Promise<ActivityTrends> {
    const data = await this.request<any[]>('/dashboard/activity');
    
    // Convert to the format expected by the frontend
    const posts = data.map(item => item.posts);
    const threats = data.map(item => item.threats);
    const trends = data.map(item => item.trends);
    
    return {
      posts,
      threats,
      trends
    };
  }

  // Permissions endpoints
  async updatePermissions(permissions: { platforms: string[] }): Promise<any> {
    return this.request('/api/auth/permissions', {
      method: 'POST',
      body: JSON.stringify(permissions),
    });
  }

  async getPermissions(): Promise<any> {
    return this.request('/api/auth/permissions');
  }

  // Data collection endpoint
  async triggerDataCollection(): Promise<any> {
    return this.request('/auth/collect-data', {
      method: 'POST',
    });
  }

  // Update user avatar
  async updateAvatar(avatar: string): Promise<any> {
    // NOTE: auth routes are mounted at /api/auth on the backend
    return this.request('/api/auth/avatar', {
      method: 'PUT',
      body: JSON.stringify({ avatar }),
    });
  }

  // Get EDA dashboard statistics
  async getEdaDashboardStats(userId: string, username?: string): Promise<any> {
    const queryParams = username ? `?username=${username}` : '';
    return this.request(`/api/scraper/dashboard/stats/${userId}${queryParams}`);
  }

  // Convenience methods for HTTP verbs
  async get<T = any>(endpoint: string): Promise<{ data: T }> {
    const data = await this.request<T>(endpoint);
    return { data };
  }

  async post<T = any>(endpoint: string, body?: any): Promise<{ data: T }> {
    const data = await this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
    return { data };
  }

  async put<T = any>(endpoint: string, body?: any): Promise<{ data: T }> {
    const data = await this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
    return { data };
  }

  async delete<T = any>(endpoint: string): Promise<{ data: T }> {
    const data = await this.request<T>(endpoint, {
      method: 'DELETE',
    });
    return { data };
  }
}

// Create singleton instance
const apiClient = new ApiClient();

export default apiClient;
export { apiClient, getApiBaseUrl };
export type { UserData, User, AuthResponse, DashboardStats, ThreatAlert, ActivityTrends };