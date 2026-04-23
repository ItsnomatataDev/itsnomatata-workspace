import { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Plus,
  Edit,
  Trash2,
  Eye,
  Share2,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  MessageSquare,
} from "lucide-react";

interface ContentItem {
  id: string;
  title: string;
  platform: "facebook" | "instagram" | "both";
  contentType: "post" | "reel" | "story" | "ad";
  status: "draft" | "scheduled" | "published" | "failed";
  scheduledDate: string;
  scheduledTime: string;
  content: string;
  hashtags: string[];
  media?: string[];
  engagement?: {
    likes: number;
    comments: number;
    shares: number;
    reach: number;
  };
  performance?: number;
}

interface ContentCalendarProps {
  organizationId: string;
}

export default function ContentCalendar({ organizationId }: ContentCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadContentItems();
  }, [currentDate, organizationId]);

  const loadContentItems = async () => {
    // Simulate loading content items
    const mockItems: ContentItem[] = [
      {
        id: "1",
        title: "Product Launch Announcement",
        platform: "instagram",
        contentType: "reel",
        status: "scheduled",
        scheduledDate: new Date(currentDate.getFullYear(), currentDate.getMonth(), 15).toISOString(),
        scheduledTime: "10:00 AM",
        content: "Exciting news! Our new product is finally here...",
        hashtags: ["#productlaunch", "#newproduct", "#innovation"],
        performance: 85,
      },
      {
        id: "2",
        title: "Behind the Scenes",
        platform: "facebook",
        contentType: "post",
        status: "published",
        scheduledDate: new Date(currentDate.getFullYear(), currentDate.getMonth(), 10).toISOString(),
        scheduledTime: "2:00 PM",
        content: "Take a look behind the scenes at our creative process...",
        hashtags: ["#behindthescenes", "#creative", "#team"],
        engagement: {
          likes: 1250,
          comments: 89,
          shares: 45,
          reach: 8500,
        },
        performance: 92,
      },
      {
        id: "3",
        title: "Customer Testimonial",
        platform: "both",
        contentType: "story",
        status: "draft",
        scheduledDate: new Date(currentDate.getFullYear(), currentDate.getMonth(), 20).toISOString(),
        scheduledTime: "6:00 PM",
        content: "Hear what our customers are saying about us...",
        hashtags: ["#testimonial", "#customers", "#satisfaction"],
        performance: 78,
      },
      {
        id: "4",
        title: "Industry Insights",
        platform: "instagram",
        contentType: "post",
        status: "failed",
        scheduledDate: new Date(currentDate.getFullYear(), currentDate.getMonth(), 5).toISOString(),
        scheduledTime: "12:00 PM",
        content: "Latest trends in our industry...",
        hashtags: ["#industry", "#trends", "#insights"],
        performance: 65,
      },
    ];

    setContentItems(mockItems);
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDateString = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const getItemsForDate = (date: Date) => {
    const dateString = formatDateString(date);
    return contentItems.filter(item => 
      item.scheduledDate.split('T')[0] === dateString
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published": return "bg-green-500/10 border-green-500/20 text-green-400";
      case "scheduled": return "bg-blue-500/10 border-blue-500/20 text-blue-400";
      case "draft": return "bg-gray-500/10 border-gray-500/20 text-gray-400";
      case "failed": return "bg-red-500/10 border-red-500/20 text-red-400";
      default: return "bg-white/10 border-white/20 text-white";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "published": return <CheckCircle size={14} />;
      case "scheduled": return <Clock size={14} />;
      case "draft": return <Edit size={14} />;
      case "failed": return <AlertCircle size={14} />;
      default: return <Eye size={14} />;
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "facebook": return "f";
      case "instagram": return "i";
      case "both": return "f+i";
      default: return platform;
    }
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case "post": return "P";
      case "reel": return "R";
      case "story": return "S";
      case "ad": return "A";
      default: return type;
    }
  };

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const filteredItems = contentItems.filter(item => {
    const matchesStatus = filterStatus === "all" || item.status === filterStatus;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const renderCalendarView = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 border border-white/5"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const items = getItemsForDate(date);
      const isToday = formatDateString(date) === formatDateString(new Date());
      const isSelected = selectedDate && formatDateString(date) === formatDateString(selectedDate);

      days.push(
        <div
          key={day}
          className={`h-24 border border-white/10 p-2 cursor-pointer transition-colors ${
            isToday ? "bg-orange-500/10 border-orange-500/30" : ""
          } ${isSelected ? "bg-blue-500/10 border-blue-500/30" : ""} hover:bg-white/5`}
          onClick={() => setSelectedDate(date)}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-sm font-medium ${isToday ? "text-orange-400" : "text-white"}`}>
              {day}
            </span>
            {items.length > 0 && (
              <span className="text-xs bg-orange-500/20 text-orange-400 px-1 rounded">
                {items.length}
              </span>
            )}
          </div>
          <div className="space-y-1 overflow-hidden">
            {items.slice(0, 2).map((item) => (
              <div
                key={item.id}
                className={`text-xs p-1 rounded border ${getStatusColor(item.status)} truncate`}
                title={item.title}
              >
                <span className="mr-1">{getPlatformIcon(item.platform)}</span>
                <span className="mr-1">{getContentTypeIcon(item.contentType)}</span>
                {item.title}
              </div>
            ))}
            {items.length > 2 && (
              <div className="text-xs text-white/40">+{items.length - 2} more</div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  const renderListView = () => {
    return (
      <div className="space-y-3">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className={`p-4 rounded-lg border ${getStatusColor(item.status)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(item.status)}`}>
                    {getStatusIcon(item.status)} {item.status}
                  </span>
                  <span className="text-xs text-white/60">
                    {getPlatformIcon(item.platform)} {item.platform}
                  </span>
                  <span className="text-xs text-white/60">
                    {getContentTypeIcon(item.contentType)} {item.contentType}
                  </span>
                  {item.performance && (
                    <span className="text-xs text-green-400">
                      <TrendingUp size={12} className="inline mr-1" />
                      {item.performance}%
                    </span>
                  )}
                </div>
                
                <h3 className="text-white font-medium mb-2">{item.title}</h3>
                <p className="text-sm text-white/80 mb-2 line-clamp-2">{item.content}</p>
                
                <div className="flex items-center gap-4 text-xs text-white/60">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(item.scheduledDate).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {item.scheduledTime}
                  </span>
                  {item.engagement && (
                    <>
                      <span className="flex items-center gap-1">
                        <Eye size={12} />
                        {item.engagement.likes} likes
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare size={12} />
                        {item.engagement.comments} comments
                      </span>
                    </>
                  )}
                </div>
                
                {item.hashtags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.hashtags.slice(0, 3).map((tag, index) => (
                      <span key={index} className="text-xs bg-white/10 px-2 py-1 rounded">
                        {tag}
                      </span>
                    ))}
                    {item.hashtags.length > 3 && (
                      <span className="text-xs text-white/40">+{item.hashtags.length - 3} more</span>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2 ml-4">
                <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <Eye size={16} />
                </button>
                <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <Edit size={16} />
                </button>
                <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <Share2 size={16} />
                </button>
                <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Calendar className="text-orange-400" />
              Content Calendar
            </h1>
            <p className="text-white/60 mt-1">Plan and schedule your social media content</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-medium transition-colors"
            >
              <Plus size={16} />
              Create Content
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* View Toggle */}
            <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-1">
              <button
                onClick={() => setViewMode("calendar")}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  viewMode === "calendar" ? "bg-orange-500 text-white" : "text-white/60 hover:text-white"
                }`}
              >
                Calendar
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  viewMode === "list" ? "bg-orange-500 text-white" : "text-white/60 hover:text-white"
                }`}
              >
                List
              </button>
            </div>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500/50"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search content..."
                className="pl-10 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-none focus:border-orange-500/50"
              />
            </div>
          </div>
        </div>

        {/* Calendar View */}
        {viewMode === "calendar" && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              
              <h2 className="text-xl font-semibold text-white">
                {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </h2>
              
              <button
                onClick={() => navigateMonth(1)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center text-sm font-medium text-white/60 py-2">
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {renderCalendarView()}
            </div>
          </div>
        )}

        {/* List View */}
        {viewMode === "list" && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                All Content ({filteredItems.length})
              </h3>
            </div>
            {renderListView()}
          </div>
        )}

        {/* Selected Date Details */}
        {selectedDate && viewMode === "calendar" && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </h3>
              <button
                onClick={() => setSelectedDate(null)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            {getItemsForDate(selectedDate).length > 0 ? (
              <div className="space-y-3">
                {getItemsForDate(selectedDate).map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg border ${getStatusColor(item.status)}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-white font-medium">{item.title}</h4>
                        <p className="text-sm text-white/60 mt-1">
                          {item.platform} - {item.contentType} at {item.scheduledTime}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(item.status)}
                        {item.performance && (
                          <span className="text-xs text-green-400">{item.performance}%</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-white/40">
                No content scheduled for this date
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
