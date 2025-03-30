import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Play, ThumbsUp, User, ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SubmitVideoForm } from "@/components/explore/submit-video-form";
import { MyVideos } from "@/components/explore/my-videos";
import ReactPlayer from "react-player/lazy";

interface Video {
  id: number;
  title: string;
  url: string;
  channelTitle: string;
  categoryId: string;
  thumbnail?: string;
  viewCount?: string;
  likeCount?: string;
  userId: number;
  createdAt: string;
  status: string;
}

interface Category {
  id: string;
  title: string;
  videos: Video[];
}

// Helper function to extract YouTube video ID from URL
const getYoutubeId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

// Helper function to get YouTube thumbnail URL
const getYoutubeThumbnail = (url: string): string => {
  const videoId = getYoutubeId(url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : '';
};

export default function ExplorePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<string>("gaming");
  const [loading, setLoading] = useState<boolean>(true);
  const { toast } = useToast();

  useEffect(() => {
    // Fetch videos when component mounts
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      // Categories of GPU-related content
      const videoCategories: Category[] = [
        {
          id: "gaming",
          title: "Gaming with GPUs",
          videos: []
        },
        {
          id: "ai",
          title: "AI & Machine Learning",
          videos: []
        },
        {
          id: "rendering",
          title: "3D Rendering & Design",
          videos: []
        },
        {
          id: "mining",
          title: "Crypto Mining",
          videos: []
        }
      ];

      // Fetch videos from the API
      const response = await apiRequest("GET", "/api/videos");
      
      if (!response.ok) {
        throw new Error("Failed to fetch videos");
      }
      
      const videos = await response.json();
      
      // Filter videos by category and only show approved ones
      const approvedVideos = videos.filter((video: Video) => video.status === "approved");
      
      // Assign videos to their respective categories
      videoCategories.forEach(category => {
        category.videos = approvedVideos
          .filter((video: Video) => video.categoryId === category.id)
          .map((video: Video) => ({
            ...video,
            thumbnail: getYoutubeThumbnail(video.url)
          }));
      });

      setCategories(videoCategories);
    } catch (error) {
      console.error("Error fetching videos:", error);
      toast({
        title: "Error",
        description: "Failed to fetch videos. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openVideoLink = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground">
      {/* Sidebar - hidden on mobile */}
      <Sidebar className="hidden md:flex" />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          {/* Page Title and Actions */}
          <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Explore GPU Uses</h1>
              <p className="text-muted-foreground">
                Discover exciting GPU applications through user-created videos
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <MyVideos />
              <SubmitVideoForm onSuccess={fetchVideos} />
            </div>
          </div>

          {/* Category Tabs */}
          <Tabs defaultValue="gaming" value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList className="mb-4">
              {categories.map((category) => (
                <TabsTrigger key={category.id} value={category.id}>
                  {category.title}
                </TabsTrigger>
              ))}
            </TabsList>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              categories.map((category) => (
                <TabsContent key={category.id} value={category.id} className="mt-0">
                  {category.videos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                      <Info className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-xl font-medium mb-2">No videos available</h3>
                      <p className="text-muted-foreground max-w-md">
                        There are no approved videos in this category yet. Be the first to contribute!
                      </p>
                      <SubmitVideoForm onSuccess={fetchVideos} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {category.videos.map((video) => (
                        <Card key={video.id} className="overflow-hidden">
                          <div 
                            className="relative cursor-pointer group"
                            onClick={() => openVideoLink(video.url)}
                          >
                            {video.thumbnail ? (
                              <img 
                                src={video.thumbnail} 
                                alt={video.title} 
                                className="w-full aspect-video object-cover"
                                onError={(e) => {
                                  // Fallback if thumbnail fails to load
                                  (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=Video';
                                }}
                              />
                            ) : (
                              <div className="w-full aspect-video bg-muted flex items-center justify-center">
                                <Play className="h-12 w-12 text-muted-foreground" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <ExternalLink className="h-10 w-10 text-white" />
                            </div>
                          </div>
                          <CardContent className="p-4">
                            <h3 className="font-semibold line-clamp-2 mb-2">{video.title}</h3>
                            <div className="flex items-center text-sm text-muted-foreground mb-2">
                              <User className="h-3 w-3 mr-1" />
                              <span>{video.channelTitle}</span>
                            </div>
                            
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full mt-3 flex items-center gap-2"
                              onClick={() => openVideoLink(video.url)}
                            >
                              <Play className="h-3 w-3" />
                              Watch on YouTube
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))
            )}
          </Tabs>
        </main>
      </div>
    </div>
  );
}