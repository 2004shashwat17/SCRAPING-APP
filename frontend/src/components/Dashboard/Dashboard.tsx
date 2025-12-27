import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  Chip,
  useTheme,
  CircularProgress,
  Alert,
  Skeleton,
} from '@mui/material';
import {
  Security as SecurityIcon,
  TrendingUp as TrendingUpIcon,
  Article as ArticleIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import apiClient from '../../services/apiClient';

// Mock data for demonstration
const threatLevelData = [
  { name: 'Critical', value: 5, color: '#f44336' },
  { name: 'High', value: 23, color: '#ff9800' },
  { name: 'Medium', value: 67, color: '#ffc107' },
  { name: 'Low', value: 145, color: '#4caf50' },
  { name: 'None', value: 860, color: '#2196f3' },
];

const dailyActivityData = [
  { date: '2025-09-17', posts: 245, threats: 12, trends: 8 },
  { date: '2025-09-18', posts: 289, threats: 15, trends: 12 },
  { date: '2025-09-19', posts: 312, threats: 18, trends: 15 },
  { date: '2025-09-20', posts: 267, threats: 9, trends: 11 },
  { date: '2025-09-21', posts: 298, threats: 14, trends: 9 },
  { date: '2025-09-22', posts: 334, threats: 21, trends: 18 },
  { date: '2025-09-23', posts: 287, threats: 16, trends: 13 },
];

const platformData = [
  { platform: 'Twitter', posts: 156, threats: 12 },
  { platform: 'Facebook', posts: 89, threats: 8 },
  { platform: 'Instagram', posts: 67, threats: 3 },
];

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'stable';
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color,
  trend,
  trendDirection,
}) => {
  const theme = useTheme();

  return (
    <Card sx={{ height: '100%', position: 'relative', overflow: 'visible' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography color="text.secondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div" sx={{ fontWeight: 700, color }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
            {trend && (
              <Box sx={{ mt: 1 }}>
                <Chip
                  label={trend}
                  size="small"
                  color={
                    trendDirection === 'up' ? 'success' :
                    trendDirection === 'down' ? 'error' : 'default'
                  }
                  variant="outlined"
                />
              </Box>
            )}
          </Box>
          <Box
            sx={{
              backgroundColor: color + '20',
              borderRadius: 2,
              p: 1.5,
              color,
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const Dashboard: React.FC = () => {
  const theme = useTheme();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [threatAlerts, setThreatAlerts] = useState<any[]>([]);
  const [activityData, setActivityData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Function to load dashboard data
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all dashboard data in parallel
      const [stats, alerts, trends] = await Promise.all([
        apiClient.getDashboardStats(),
        apiClient.getThreatAlerts(),
        apiClient.getActivityTrends(),
      ]);

      setDashboardData(stats);
      setThreatAlerts(alerts);
      
      // Transform activity trends data for charts
      const chartData = trends.posts.map((posts: number, index: number) => ({
        date: `2025-09-${17 + index}`,
        posts,
        threats: trends.threats[index] || 0,
        trends: trends.trends[index] || 0,
      }));
      setActivityData(chartData);
      
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    loadDashboardData();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Show loading state
  if (loading && !dashboardData) {
    return (
      <Box sx={{ flexGrow: 1, p: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ mb: 3, fontWeight: 700 }}>
          Intelligence Dashboard
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 3 }}>
          {[1, 2, 3, 4].map((item) => (
            <Card key={item}>
              <CardContent>
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="40%" height={40} />
                <Skeleton variant="text" width="80%" />
              </CardContent>
            </Card>
          ))}
        </Box>
      </Box>
    );
  }

  // Show error state
  if (error) {
    return (
      <Box sx={{ flexGrow: 1, p: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ mb: 3, fontWeight: 700 }}>
          Intelligence Dashboard
        </Typography>
        <Alert 
          severity="error" 
          action={
            <RefreshIcon 
              sx={{ cursor: 'pointer' }} 
              onClick={loadDashboardData}
            />
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Intelligence Dashboard
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </Typography>
          {loading && <CircularProgress size={20} />}
          <RefreshIcon 
            sx={{ cursor: 'pointer', color: 'text.secondary' }} 
            onClick={loadDashboardData}
          />
        </Box>
      </Box>

      {/* Stats Cards */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
        <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
          <StatCard
            title="Total Posts"
            value={dashboardData?.totalPosts?.toLocaleString() || "0"}
            subtitle="Last 24 hours"
            icon={<ArticleIcon />}
            color={theme.palette.primary.main}
            trend="+12%"
            trendDirection="up"
          />
        </Box>
        <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
          <StatCard
            title="Active Threats"
            value={dashboardData?.activeThreats?.toString() || "0"}
            subtitle="Requiring attention"
            icon={<SecurityIcon />}
            color={theme.palette.error.main}
            trend="+8%"
            trendDirection="up"
          />
        </Box>
        <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
          <StatCard
            title="Trending Topics"
            value={dashboardData?.trendingTopics?.toString() || "0"}
            subtitle="Detected patterns"
            icon={<TrendingUpIcon />}
            color={theme.palette.success.main}
            trend="+5%"
            trendDirection="up"
          />
        </Box>
        <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
          <StatCard
            title="System Health"
            value={dashboardData?.systemHealth ? `${dashboardData.systemHealth}%` : "0%"}
            subtitle="Uptime"
            icon={<CheckCircleIcon />}
            color={theme.palette.success.main}
            trend="Stable"
            trendDirection="stable"
          />
        </Box>
      </Box>

      {/* Charts Row */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
        {/* Daily Activity Chart */}
        <Box sx={{ flex: '2 1 600px', minWidth: '400px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Daily Activity Trends
              </Typography>
              <Box sx={{ height: 300, mt: 2 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                    <XAxis 
                      dataKey="date" 
                      stroke={theme.palette.text.secondary}
                      fontSize={12}
                    />
                    <YAxis stroke={theme.palette.text.secondary} fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 8,
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="posts"
                      stroke={theme.palette.primary.main}
                      strokeWidth={2}
                      name="Posts"
                    />
                    <Line
                      type="monotone"
                      dataKey="threats"
                      stroke={theme.palette.error.main}
                      strokeWidth={2}
                      name="Threats"
                    />
                    <Line
                      type="monotone"
                      dataKey="trends"
                      stroke={theme.palette.success.main}
                      strokeWidth={2}
                      name="Trends"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Threat Level Distribution */}
        <Box sx={{ flex: '1 1 300px', minWidth: '300px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Threat Level Distribution
              </Typography>
              <Box sx={{ height: 300, mt: 2 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={threatLevelData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }: { name?: string; percent?: number }) => 
                        `${name} ${((percent || 0) * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {threatLevelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Platform Analytics and Recent Alerts */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {/* Platform Analytics */}
        <Box sx={{ flex: '1 1 400px', minWidth: '300px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Platform Analytics
              </Typography>
              <Box sx={{ height: 250, mt: 2 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={platformData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                    <XAxis 
                      dataKey="platform" 
                      stroke={theme.palette.text.secondary}
                      fontSize={12}
                    />
                    <YAxis stroke={theme.palette.text.secondary} fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 8,
                      }}
                    />
                    <Legend />
                    <Bar dataKey="posts" fill={theme.palette.primary.main} name="Posts" />
                    <Bar dataKey="threats" fill={theme.palette.error.main} name="Threats" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Recent Alerts */}
        <Box sx={{ flex: '1 1 400px', minWidth: '300px' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent High-Priority Alerts
              </Typography>
              <Box sx={{ mt: 2 }}>
                {[
                  { level: 'Critical', message: 'Suspicious coordinated activity detected', time: '5 min ago', platform: 'Twitter' },
                  { level: 'High', message: 'Unusual keyword frequency spike', time: '12 min ago', platform: 'Facebook' },
                  { level: 'High', message: 'New threat pattern identified', time: '23 min ago', platform: 'Instagram' },
                  { level: 'Medium', message: 'Geographic clustering observed', time: '1 hour ago', platform: 'Twitter' },
                ].map((alert, index) => (
                  <Paper
                    key={index}
                    sx={{
                      p: 2,
                      mb: 1,
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: theme.palette.background.default,
                      border: `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    <Box sx={{ mr: 2 }}>
                      {alert.level === 'Critical' && <ErrorIcon color="error" />}
                      {alert.level === 'High' && <WarningIcon color="warning" />}
                      {alert.level === 'Medium' && <ErrorIcon color="info" />}
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {alert.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {alert.platform} • {alert.time}
                      </Typography>
                    </Box>
                    <Chip
                      label={alert.level}
                      size="small"
                      color={
                        alert.level === 'Critical' ? 'error' :
                        alert.level === 'High' ? 'warning' : 'info'
                      }
                      variant="outlined"
                    />
                  </Paper>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;