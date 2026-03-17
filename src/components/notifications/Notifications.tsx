import React, { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const mockNotifications = [
  { id: 1, type: 'new_quiz', message: 'A new quiz "React Hooks" has been assigned to you.', read: false, date: '2023-11-01T10:00:00Z' },
  { id: 2, type: 'quiz_graded', message: 'Your quiz "React Fundamentals" has been graded. You scored 85%.', read: false, date: '2023-10-30T14:30:00Z' },
  { id: 3, type: 'class_update', message: 'The deadline for the "Advanced CSS" quiz has been extended to Nov 5th.', read: true, date: '2023-10-29T09:00:00Z' },
];

const Notifications = () => {
  const [notifications, setNotifications] = useState(mockNotifications);

  const markAsRead = (id) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center">
          <Bell className="mr-2" />
          Notifications
        </CardTitle>
        {unreadCount > 0 && <Badge>{unreadCount} New</Badge>}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {notifications.map(notification => (
            <div key={notification.id} className={`p-3 rounded-lg ${notification.read ? 'bg-muted/50' : 'bg-primary/10'}`}>
              <div className="flex justify-between items-start">
                <p className="text-sm">{notification.message}</p>
                {!notification.read && (
                  <Button variant="ghost" size="icon" onClick={() => markAsRead(notification.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(notification.date).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
        {notifications.length === 0 && (
          <p className="text-center text-muted-foreground py-4">No new notifications.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default Notifications;