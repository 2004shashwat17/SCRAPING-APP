/**
 * API client configuration and utilities for communicating with the FastAPI backend
 */

// Determine API base URL based on current location
const getApiBaseUrl = () => {
  // Check for override in localStorage (for development)
  const overrideUrl = localStorage.getItem('API_BASE_URL');
  if (overrideUrl) {
    return overrideUrl;
  }
  
  // Check environment variable
  if (process.env.REACT_APP_API_BASE_URL) {
    return process.env.REACT_APP_API_BASE_URL;
  }
  
  const currentOrigin = window.location.origin;
  
  // If accessing through localtunnel, proxy API calls to localhost (backend runs locally)
  if (currentOrigin.includes('loca.lt')) {
    return 'http://127.0.0.1:5001/api';
  }
  
  // Otherwise use localhost
  return 'http://127.0.0.1:5001/api';
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
    this.token = token;
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
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

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const config: RequestInit = {
      headers: this.getHeaders(),
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
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
    return this.request<AuthResponse>('/auth/register', {
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
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      headers,
      body: JSON.stringify({ username, password }),
    });
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async logout(): Promise<{ message: string }> {
    const result = await this.request<{ message: string }>('/auth/logout', { method: 'POST' });
    this.setToken(null);
    return result;
  }

  // Posts endpoints
  async getPosts(): Promise<any> {
    return this.request('/posts/');
  }

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
    return this.request('/auth/permissions', {
      method: 'POST',
      body: JSON.stringify(permissions),
    });
  }

  async getPermissions(): Promise<any> {
    return this.request('/auth/permissions');
  }

  // Data collection endpoint
  async triggerDataCollection(): Promise<any> {
    return this.request('/auth/collect-data', {
      method: 'POST',
    });
  }

  // Convenience methods for HTTP verbs
  async get<T>(endpoint: string): Promise<{ data: T }> {
    const data = await this.request<T>(endpoint);
    return { data };
  }

  async post<T>(endpoint: string, body?: any): Promise<{ data: T }> {
    const data = await this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
    return { data };
  }

  async put<T>(endpoint: string, body?: any): Promise<{ data: T }> {
    const data = await this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
    return { data };
  }

  async delete<T>(endpoint: string): Promise<{ data: T }> {
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