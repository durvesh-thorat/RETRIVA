
import React from 'react';
import { AppNotification, ViewState } from '../types';
import { Bell, Sparkles, MessageCircle, ShieldCheck, X, CheckCheck, Trash2, ChevronRight } from 'lucide-react';

interface NotificationCenterProps {
  notifications: AppNotification[];
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onNavigate: (view: ViewState) => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onNavigate
}) => {
  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'match': return <Sparkles className="w-5 h-5 text-amber-500" />;
      case 'message': return <MessageCircle className="w-5 h-5 text-brand-violet" />;
      default: return <ShieldCheck className="w-5 h-5 text-emerald-500" />;
    }
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <>
      {/* FOCUS & DEPTH: Dimmer backdrop blur overlay */}
      <div 
        className="fixed inset-0 z-[90] bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      {/* POSITIONING & ANIMATION: Scale-in transition with wider offset position */}
      <div className="fixed left-4 right-4 top-24 sm:absolute sm:top-20 sm:right-[-60px] sm:left-auto sm:w-[420px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_40px_120px_rgba(0,0,0,0.2)] dark:shadow-none border border-white dark:border-slate-800 overflow-hidden z-[100] animate-in zoom-in-95 fade-in duration-300 origin-top-right flex flex-col max-h-[75vh]">
        
        {/* Header */}
        <div className="px-7 py-6 border-b border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h3 className="font-black text-xl text-slate-800 dark:text-white tracking-tight">Activity</h3>
            {unreadCount > 0 && (
              <span className="px-3 py-1 bg-brand-violet text-white text-[10px] font-black rounded-full shadow-lg shadow-brand-violet/20 uppercase tracking-widest">
                {unreadCount} New
              </span>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-all rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 hover:rotate-90"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* List Content: Styled Thin Violet Scrollbar */}
        <div className="overflow-y-auto flex-1 notification-scrollbar scroll-smooth bg-white dark:bg-slate-900">
          {notifications.length === 0 ? (
            <div className="py-20 px-10 flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 bg-indigo-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 ring-1 ring-indigo-100 dark:ring-slate-700">
                <Bell className="w-10 h-10 text-indigo-200 dark:text-slate-600" />
              </div>
              <p className="text-slate-900 dark:text-white font-black text-lg tracking-tight">Zero notifications</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-[220px] font-medium leading-relaxed">
                When people interact with your reports, they'll appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {notifications.map((notification) => (
                <div 
                  key={notification.id}
                  onClick={() => {
                    onMarkAsRead(notification.id);
                    if (notification.link) onNavigate(notification.link);
                  }}
                  className={`relative p-6 flex gap-4 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 group ${
                    !notification.isRead ? 'bg-brand-violet/5 dark:bg-brand-violet/10' : ''
                  }`}
                >
                  {/* Unread Indicator */}
                  {!notification.isRead && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-violet"></div>
                  )}

                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-[1.25rem] shrink-0 flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-700/50 ${
                    notification.type === 'match' ? 'bg-amber-50 dark:bg-amber-900/20' :
                    notification.type === 'message' ? 'bg-indigo-50 dark:bg-indigo-900/20' :
                    'bg-emerald-50 dark:bg-emerald-900/20'
                  }`}>
                    {getIcon(notification.type)}
                  </div>

                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex justify-between items-start mb-1.5">
                      <p className={`text-sm font-black truncate pr-2 ${
                        !notification.isRead ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
                      }`}>
                        {notification.title}
                      </p>
                      <span className="text-[10px] font-black text-slate-400 whitespace-nowrap bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                        {formatTime(notification.timestamp)}
                      </span>
                    </div>
                    
                    <p className={`text-xs leading-relaxed line-clamp-2 font-medium ${
                       !notification.isRead ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      {notification.message}
                    </p>

                    {notification.link && (
                       <div className="mt-2.5 flex items-center text-[10px] font-black text-brand-violet opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0 duration-300">
                          VIEW UPDATE <ChevronRight className="w-3 h-3 ml-1" />
                       </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer: INTERACTIVITY - Mark All as Read & Clear All */}
        {notifications.length > 0 && (
          <div className="p-5 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-3">
            <button 
              onClick={(e) => { e.stopPropagation(); onMarkAllAsRead(); }}
              disabled={unreadCount === 0}
              className="py-3 px-4 rounded-2xl flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all hover:bg-brand-violet/5 dark:hover:bg-brand-violet/10 hover:text-brand-violet disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <CheckCheck className="w-4 h-4 group-hover:scale-110 transition-transform" /> Mark as Read
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onClearAll(); }}
              className="py-3 px-4 rounded-2xl flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all border border-transparent hover:border-red-100 dark:hover:border-red-900/40 group"
            >
              <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" /> Clear History
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default NotificationCenter;