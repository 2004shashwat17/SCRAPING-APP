import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Article as ArticleIcon,
  Comment as CommentIcon,
  Bookmark as BookmarkIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  VisibilityOff as HiddenIcon,
} from '@mui/icons-material';
import { apiClient } from '../../services/apiClient';
import type { RedditAccount } from '../../types/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`reddit-tabpanel-${index}`}
      aria-labelledby={`reddit-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const RedditDashboard: React.FC = () => {
  const [data, setData] = useState<RedditAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    loadRedditData();
  }, []);

  const loadRedditData = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<RedditAccount>('/api/oauth/reddit/data');
      setData(response.data);
    } catch (err: any) {
      console.error('Error loading Reddit data:', err);
      setError('Failed to load Reddit data');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!data) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        No Reddit data available. Please connect your Reddit account first.
      </Alert>
    );
  }

  const renderItemList = (items: any[], title: string, icon: React.ReactNode) => (
    <Card>
      <CardHeader
        avatar={icon}
        title={`${title} (${items.length})`}
      />
      <CardContent>
        <List sx={{ maxHeight: 400, overflow: 'auto' }}>
          {items.length === 0 ? (
            <ListItem>
              <ListItemText primary="No items found" />
            </ListItem>
          ) : (
            items.map((item, index) => (
              <React.Fragment key={index}>
                <ListItem>
                  <ListItemText
                    primary={item.title || item.body || 'No title'}
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {item.subreddit && `r/${item.subreddit}`} • Score: {item.score} • {new Date(item.created_utc * 1000).toLocaleDateString()}
                        </Typography>
                        {item.url && (
                          <Typography variant="body2" color="primary">
                            <a href={item.url} target="_blank" rel="noopener noreferrer">
                              {item.url}
                            </a>
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
                {index < items.length - 1 && <Divider />}
              </React.Fragment>
            ))
          )}
        </List>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Reddit Dashboard
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 3, mb: 3 }}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center">
              <ArticleIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Box>
                <Typography variant="h6">{data.counts.posts}</Typography>
                <Typography variant="body2" color="text.secondary">Posts</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center">
              <CommentIcon sx={{ mr: 1, color: 'secondary.main' }} />
              <Box>
                <Typography variant="h6">{data.counts.comments}</Typography>
                <Typography variant="body2" color="text.secondary">Comments</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center">
              <BookmarkIcon sx={{ mr: 1, color: 'success.main' }} />
              <Box>
                <Typography variant="h6">{data.counts.saved}</Typography>
                <Typography variant="body2" color="text.secondary">Saved</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center">
              <ThumbUpIcon sx={{ mr: 1, color: 'warning.main' }} />
              <Box>
                <Typography variant="h6">{data.counts.upvoted}</Typography>
                <Typography variant="body2" color="text.secondary">Upvoted</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Card>
        <CardContent>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="reddit data tabs">
            <Tab label="Posts" />
            <Tab label="Comments" />
            <Tab label="Saved" />
            <Tab label="Upvoted" />
            <Tab label="Downvoted" />
            <Tab label="Hidden" />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            {renderItemList(data.data.posts, 'Posts', <ArticleIcon />)}
          </TabPanel>
          <TabPanel value={tabValue} index={1}>
            {renderItemList(data.data.comments, 'Comments', <CommentIcon />)}
          </TabPanel>
          <TabPanel value={tabValue} index={2}>
            {renderItemList(data.data.saved, 'Saved Items', <BookmarkIcon />)}
          </TabPanel>
          <TabPanel value={tabValue} index={3}>
            {renderItemList(data.data.upvoted, 'Upvoted Items', <ThumbUpIcon />)}
          </TabPanel>
          <TabPanel value={tabValue} index={4}>
            {renderItemList(data.data.downvoted, 'Downvoted Items', <ThumbDownIcon />)}
          </TabPanel>
          <TabPanel value={tabValue} index={5}>
            {renderItemList(data.data.hidden, 'Hidden Items', <HiddenIcon />)}
          </TabPanel>
        </CardContent>
      </Card>
    </Box>
  );
};

export default RedditDashboard;