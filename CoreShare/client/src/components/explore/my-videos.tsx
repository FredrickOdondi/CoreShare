import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  ExternalLink, 
  Loader2, 
  VideoIcon,
  Trash2,
  Edit,
  AlertCircle,
  Save
} from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useForm } from "react-hook-form";

interface Video {
  id: number;
  title: string;
  url: string;
  status: string;
  categoryId: string;
  createdAt: string;
  rejectionReason?: string;
  viewCount?: number;
}

// All videos are now published directly with "approved" status
const publishedBadgeColor = "bg-green-500";

const categoryNames: Record<string, string> = {
  gaming: "Gaming with GPUs",
  ai: "AI & Machine Learning",
  rendering: "3D Rendering & Design",
  mining: "Crypto Mining",
};

// Video form validation schema
const videoFormSchema = z.object({
  title: z.string().min(3, {
    message: "Title must be at least 3 characters.",
  }).max(100, {
    message: "Title cannot be longer than 100 characters."
  }),
  url: z.string().url({
    message: "Please enter a valid URL.",
  }),
  categoryId: z.string({
    required_error: "Please select a category.",
  }),
});

type VideoFormValues = z.infer<typeof videoFormSchema>;

export function MyVideos() {
  const [open, setOpen] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  const fetchMyVideos = async () => {
    setLoading(true);
    try {
      const response = await apiRequest("GET", "/api/my/videos");
      
      if (!response.ok) {
        throw new Error("Failed to fetch videos");
      }
      
      const data = await response.json();
      setVideos(data);
    } catch (error: any) {
      toast({
        title: "Error fetching videos",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchMyVideos();
    }
  }, [open]);

  const openVideoLink = async (url: string, videoId: number) => {
    try {
      // Increment view count when video is opened
      await apiRequest("POST", `/api/videos/${videoId}/view`);
      
      // Open the video in a new tab
      window.open(url, '_blank');
    } catch (error) {
      console.error("Error incrementing view count:", error);
      // Still open the video even if the view count update fails
      window.open(url, '_blank');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };
  
  const handleDeleteClick = (video: Video) => {
    setSelectedVideo(video);
    setDeleteDialogOpen(true);
  };
  
  const handleEditClick = (video: Video) => {
    setSelectedVideo(video);
    setEditDialogOpen(true);
  };
  
  const form = useForm<VideoFormValues>({
    resolver: zodResolver(videoFormSchema),
    defaultValues: {
      title: "",
      url: "",
      categoryId: "",
    },
  });
  
  // Reset form when selected video changes or edit dialog opens
  useEffect(() => {
    if (selectedVideo && editDialogOpen) {
      form.reset({
        title: selectedVideo.title,
        url: selectedVideo.url,
        categoryId: selectedVideo.categoryId,
      });
    }
  }, [selectedVideo, editDialogOpen, form]);
  
  const handleEditSubmit = async (values: VideoFormValues) => {
    if (!selectedVideo) return;
    
    setUpdating(true);
    try {
      const response = await apiRequest("PATCH", `/api/videos/${selectedVideo.id}`, values);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update video");
      }
      
      const updatedVideo = await response.json();
      
      // Update the video in the state
      setVideos(videos.map(v => v.id === selectedVideo.id ? updatedVideo : v));
      
      toast({
        title: "Video updated",
        description: "Your video has been successfully updated",
      });
      
      setEditDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error updating video",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };
  
  const handleDeleteConfirm = async () => {
    if (!selectedVideo) return;
    
    setDeleting(true);
    try {
      const response = await apiRequest("DELETE", `/api/videos/${selectedVideo.id}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete video");
      }
      
      // Remove the deleted video from state
      setVideos(videos.filter(v => v.id !== selectedVideo.id));
      
      toast({
        title: "Video deleted",
        description: "Your video has been successfully deleted",
      });
      
      setDeleteDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error deleting video",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <VideoIcon className="h-4 w-4" />
            My Shared Videos
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>My Shared Videos</DialogTitle>
          </DialogHeader>
          
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : videos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <p className="text-muted-foreground mb-2">You haven't shared any videos yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Published</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos.map((video) => (
                    <TableRow key={video.id}>
                      <TableCell className="font-medium">{video.title}</TableCell>
                      <TableCell>{categoryNames[video.categoryId] || video.categoryId}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`${publishedBadgeColor} text-white border-none`}
                        >
                          Published
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            width="12" 
                            height="12" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            className="mr-1"
                          >
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          {video.viewCount || 0}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(video.createdAt)}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openVideoLink(video.url, video.id)}
                          title="Watch video"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(video)}
                          title="Edit video"
                        >
                          <Edit className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(video)}
                          title="Delete video"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Video</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this video? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex items-center p-4 bg-muted/50 rounded-md">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <span className="font-medium">{selectedVideo?.title}</span>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit video dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Video</DialogTitle>
            <DialogDescription>
              Update your video information below. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Video title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Video URL</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://www.youtube.com/watch?v=..." 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Enter a valid YouTube, Vimeo, or similar video URL
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="gaming">Gaming with GPUs</SelectItem>
                        <SelectItem value="ai">AI & Machine Learning</SelectItem>
                        <SelectItem value="rendering">3D Rendering & Design</SelectItem>
                        <SelectItem value="mining">Crypto Mining</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                  disabled={updating}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={updating}
                >
                  {updating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}