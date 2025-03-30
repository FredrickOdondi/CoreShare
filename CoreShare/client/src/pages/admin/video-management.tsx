import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle, XCircle, ExternalLink, Play } from "lucide-react";

interface Video {
  id: number;
  title: string;
  url: string;
  channelTitle: string;
  categoryId: string;
  userId: number;
  createdAt: string;
  status: string;
  rejectionReason?: string;
}

const categoryNames: Record<string, string> = {
  gaming: "Gaming with GPUs",
  ai: "AI & Machine Learning",
  rendering: "3D Rendering & Design",
  mining: "Crypto Mining",
};

export default function VideoManagementPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>("pending");
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState<boolean>(false);
  const [processingAction, setProcessingAction] = useState<boolean>(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Check if user is admin
    if (user && user.role !== "admin") {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      setLocation("/");
      return;
    }

    fetchVideos();
  }, [user, setLocation]);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const response = await apiRequest("GET", "/api/videos?all=true");
      
      if (!response.ok) {
        throw new Error("Failed to fetch videos");
      }
      
      const data = await response.json();
      setVideos(data);
    } catch (error: any) {
      console.error("Error fetching videos:", error);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (videoId: number) => {
    setProcessingAction(true);
    try {
      const response = await apiRequest("POST", `/api/admin/videos/${videoId}/approve`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to approve video");
      }
      
      toast({
        title: "Success",
        description: "Video has been approved and is now visible to users.",
      });
      
      // Update videos list
      fetchVideos();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleReject = async () => {
    if (!selectedVideo || !rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for rejection.",
        variant: "destructive",
      });
      return;
    }

    setProcessingAction(true);
    try {
      const response = await apiRequest("POST", `/api/admin/videos/${selectedVideo.id}/reject`, {
        reason: rejectionReason.trim()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to reject video");
      }
      
      toast({
        title: "Success",
        description: "Video has been rejected.",
      });
      
      // Reset state and update videos list
      setRejectionReason("");
      setSelectedVideo(null);
      setRejectDialogOpen(false);
      fetchVideos();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setProcessingAction(false);
    }
  };

  const openRejectDialog = (video: Video) => {
    setSelectedVideo(video);
    setRejectDialogOpen(true);
  };

  const openVideoLink = (url: string) => {
    window.open(url, '_blank');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const filteredVideos = videos.filter(video => {
    if (activeTab === "pending") return video.status === "pending";
    if (activeTab === "approved") return video.status === "approved";
    if (activeTab === "rejected") return video.status === "rejected";
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground">
      {/* Sidebar - hidden on mobile */}
      <Sidebar className="hidden md:flex" />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          {/* Page Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Video Management</h1>
            <p className="text-muted-foreground">
              Review and manage user-submitted videos
            </p>
          </div>

          {/* Tabs to filter videos by status */}
          <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList className="mb-4">
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="all">All Videos</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-0">
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredVideos.length === 0 ? (
                <div className="text-center p-8 border rounded-lg">
                  <p className="text-muted-foreground">No videos found</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredVideos.map((video) => (
                    <Card key={video.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle>{video.title}</CardTitle>
                            <CardDescription>
                              Submitted by: User ID {video.userId} | 
                              Channel: {video.channelTitle} | 
                              Category: {categoryNames[video.categoryId] || video.categoryId}
                            </CardDescription>
                          </div>
                          <Badge
                            variant="outline"
                            className={`
                              ${video.status === "pending" ? "bg-yellow-500" : ""}
                              ${video.status === "approved" ? "bg-green-500" : ""}
                              ${video.status === "rejected" ? "bg-red-500" : ""}
                              text-white border-none
                            `}
                          >
                            {video.status.charAt(0).toUpperCase() + video.status.slice(1)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-col md:flex-row gap-4">
                          <div className="md:w-1/2 h-[300px] relative rounded-md overflow-hidden border">
                            <div className="w-full h-full flex items-center justify-center bg-black">
                              <a 
                                href={video.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-col items-center justify-center text-white"
                              >
                                <Play className="h-12 w-12 mb-2" />
                                <span>Play on YouTube</span>
                              </a>
                            </div>
                          </div>
                          <div className="md:w-1/2 flex flex-col">
                            <div className="mb-4">
                              <h3 className="text-sm font-medium mb-1">Video URL:</h3>
                              <div className="flex items-center space-x-2">
                                <a 
                                  href={video.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:underline break-all flex items-center"
                                >
                                  {video.url.length > 50 ? video.url.slice(0, 50) + '...' : video.url}
                                  <ExternalLink className="h-3 w-3 ml-1" />
                                </a>
                              </div>
                            </div>
                            <div className="mb-4">
                              <h3 className="text-sm font-medium mb-1">Submission Date:</h3>
                              <p>{formatDate(video.createdAt)}</p>
                            </div>
                            {video.status === "rejected" && video.rejectionReason && (
                              <div className="mb-4">
                                <h3 className="text-sm font-medium mb-1">Rejection Reason:</h3>
                                <p className="text-red-500">{video.rejectionReason}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                      
                      {video.status === "pending" && (
                        <CardFooter className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            onClick={() => openRejectDialog(video)}
                            disabled={processingAction}
                          >
                            <XCircle className="h-4 w-4 mr-2 text-red-500" />
                            Reject
                          </Button>
                          <Button
                            onClick={() => handleApprove(video.id)}
                            disabled={processingAction}
                          >
                            {processingAction ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4 mr-2" />
                            )}
                            Approve
                          </Button>
                        </CardFooter>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Rejection Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Video</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this video. This will be visible to the user.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Textarea
              placeholder="Reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setRejectDialogOpen(false)} 
              disabled={processingAction}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject} 
              disabled={processingAction || !rejectionReason.trim()}
            >
              {processingAction ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Confirm Rejection"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}