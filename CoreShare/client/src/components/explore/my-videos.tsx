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
import { ExternalLink, Loader2, VideoIcon } from "lucide-react";

interface Video {
  id: number;
  title: string;
  url: string;
  status: string;
  categoryId: string;
  createdAt: string;
  rejectionReason?: string;
}

// All videos are now published directly with "approved" status
const publishedBadgeColor = "bg-green-500";

const categoryNames: Record<string, string> = {
  gaming: "Gaming with GPUs",
  ai: "AI & Machine Learning",
  rendering: "3D Rendering & Design",
  mining: "Crypto Mining",
};

export function MyVideos() {
  const [open, setOpen] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
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

  const openVideoLink = (url: string) => {
    window.open(url, '_blank');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
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
                    <TableCell>{formatDate(video.createdAt)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openVideoLink(video.url)}
                      >
                        <ExternalLink className="h-4 w-4" />
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
  );
}