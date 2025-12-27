// TypeScript interfaces for API responses

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface SeleniumSocialAccount {
  platform: string;
  username: string;
  connected_at: string;
  profile_data: Record<string, any>;
  posts_collected: number;
  connections_collected?: number;
  status: 'connected' | 'disconnected' | 'error';
}

export interface SocialAccount {
  id: string;
  user_id: string;
  platform: string;
  platform_user_id: string;
  username: string;
  display_name?: string;
  email?: string;
  profile_url?: string;
  profile_picture?: string;
  connected_at: string;
  last_sync?: string;
  is_active: boolean;
  collect_posts: boolean;
  collect_connections: boolean;
  collect_interactions: boolean;
  // Reddit-specific counts
  posts_count?: number;
  comments_count?: number;
  saved_count?: number;
  upvoted_count?: number;
  downvoted_count?: number;
  hidden_count?: number;
}

export interface SocialPlatform {
  name: string;
  description: string;
  data_types: string[];
  features: string[];
}

export interface CollectionStats {
  total_accounts: number;
  total_posts: number;
  total_connections: number;
  total_interactions: number;
  platforms: Record<string, {
    posts: number;
    connections: number;
    interactions: number;
  }>;
}

export interface BrowserConnectionResponse {
  success: boolean;
  status: string;
  instructions?: string[];
  message?: string;
}

export interface PlatformsResponse {
  platforms: Record<string, SocialPlatform>;
}

export interface AccountsResponse {
  accounts: SeleniumSocialAccount[];
}

export interface DataCollectionResponse {
  success: boolean;
  collection_id: string;
  status: string;
  message?: string;
}

export interface OAuthAccountsResponse {
  accounts: SocialAccount[];
}

export interface OAuthConnectResponse {
  auth_url: string;
  state: string;
}

export interface RedditDataResponse {
  account: {
    id: string;
    username: string;
    display_name?: string;
    profile_url?: string;
    profile_picture?: string;
    connected_at: string;
    last_sync?: string;
  };
  data: {
    posts: Array<{
      id: string;
      title: string;
      url?: string;
      subreddit?: string;
      score: number;
      created_utc: number;
      author: string;
    }>;
    comments: Array<{
      id: string;
      title: string;
      url?: string;
      subreddit?: string;
      score: number;
      created_utc: number;
      author: string;
    }>;
    saved: Array<{
      id: string;
      title: string;
      url?: string;
      subreddit?: string;
      score: number;
      created_utc: number;
      author: string;
    }>;
    upvoted: Array<{
      id: string;
      title: string;
      url?: string;
      subreddit?: string;
      score: number;
      created_utc: number;
      author: string;
    }>;
    downvoted: Array<{
      id: string;
      title: string;
      url?: string;
      subreddit?: string;
      score: number;
      created_utc: number;
      author: string;
    }>;
    hidden: Array<{
      id: string;
      title: string;
      url?: string;
      subreddit?: string;
      score: number;
      created_utc: number;
      author: string;
    }>;
  };
  counts: {
    posts: number;
    comments: number;
    saved: number;
    upvoted: number;
    downvoted: number;
    hidden: number;
  };
}

export interface RedditAccount {
  account: {
    id: string;
    username: string;
    display_name?: string;
    profile_url?: string;
    profile_picture?: string;
    connected_at: string;
    last_sync?: string;
  };
  data: {
    posts: Array<{
      id: string;
      title: string;
      url?: string;
      subreddit?: string;
      score: number;
      created_utc: number;
      author: string;
    }>;
    comments: Array<{
      id: string;
      title: string;
      url?: string;
      subreddit?: string;
      score: number;
      created_utc: number;
      author: string;
    }>;
    saved: Array<{
      id: string;
      title: string;
      url?: string;
      subreddit?: string;
      score: number;
      created_utc: number;
      author: string;
    }>;
    upvoted: Array<{
      id: string;
      title: string;
      url?: string;
      subreddit?: string;
      score: number;
      created_utc: number;
      author: string;
    }>;
    downvoted: Array<{
      id: string;
      title: string;
      url?: string;
      subreddit?: string;
      score: number;
      created_utc: number;
      author: string;
    }>;
    hidden: Array<{
      id: string;
      title: string;
      url?: string;
      subreddit?: string;
      score: number;
      created_utc: number;
      author: string;
    }>;
  };
  counts: {
    posts: number;
    comments: number;
    saved: number;
    upvoted: number;
    downvoted: number;
    hidden: number;
  };
}