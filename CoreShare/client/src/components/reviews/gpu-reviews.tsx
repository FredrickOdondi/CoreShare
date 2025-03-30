import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Review, InsertReview, Rental, Gpu } from "@shared/schema";
import { ReviewList } from "./review-list";
import { ReviewForm } from "./review-form";
import { StarRating } from "./star-rating";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface GpuReviewsProps {
  gpu: Gpu;
  showAddReview?: boolean;
  className?: string;
}

export function GpuReviews({
  gpu,
  showAddReview = true,
  className,
}: GpuReviewsProps) {
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch reviews for this GPU
  const {
    data: reviews = [],
    isLoading: isLoadingReviews,
  } = useQuery<Review[]>({
    queryKey: ["/api/gpus", gpu.id, "reviews"],
    queryFn: async () => {
      const res = await fetch(`/api/gpus/${gpu.id}/reviews`);
      if (!res.ok) throw new Error("Failed to fetch reviews");
      return res.json();
    },
  });

  // Fetch average rating
  const {
    data: ratingData,
    isLoading: isLoadingRating,
  } = useQuery<{ averageRating: number }>({
    queryKey: ["/api/gpus", gpu.id, "rating"],
    queryFn: async () => {
      const res = await fetch(`/api/gpus/${gpu.id}/rating`);
      if (!res.ok) throw new Error("Failed to fetch rating");
      return res.json();
    },
  });

  // Fetch user's completed rentals for this GPU (to check if they can leave a review)
  const {
    data: userRentals = [],
    isLoading: isLoadingRentals,
  } = useQuery<Rental[]>({
    queryKey: ["/api/my/rentals"],
    queryFn: async () => {
      const res = await fetch("/api/my/rentals");
      if (!res.ok) throw new Error("Failed to fetch rentals");
      return res.json();
    },
    enabled: !!user && showAddReview,
  });

  // Filter completed rentals for this GPU
  const completedRentals = userRentals.filter(
    (rental) => rental.gpuId === gpu.id && rental.status === "completed"
  );

  // Check if user has any completed rentals to review
  const canReview = completedRentals.length > 0;

  // Check if user has already reviewed any of these rentals
  const userReviews = reviews.filter((review) => review.reviewerId === user?.id);
  const reviewedRentalIds = userReviews.map((review) => review.rentalId);
  
  // Find rentals that haven't been reviewed yet
  const unReviewedRentals = completedRentals.filter(
    (rental) => !reviewedRentalIds.includes(rental.id)
  );

  // Get the most recent unreviewed rental (if any)
  const rentalToReview = unReviewedRentals[0];

  // Submit review mutation
  const submitReviewMutation = useMutation({
    mutationFn: async (data: InsertReview) => {
      const res = await apiRequest("POST", "/api/reviews", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Review submitted",
        description: "Thank you for your feedback!",
      });
      setReviewDialogOpen(false);
      // Invalidate reviews cache to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/gpus", gpu.id, "reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gpus", gpu.id, "rating"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error submitting review",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmitReview = (data: InsertReview) => {
    submitReviewMutation.mutate(data);
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-medium">Reviews</h3>
          {!isLoadingRating && ratingData && (
            <div className="flex items-center">
              <StarRating value={ratingData.averageRating} size="sm" />
              <span className="ml-1 text-sm text-muted-foreground">
                ({ratingData.averageRating.toFixed(1)})
              </span>
            </div>
          )}
        </div>

        {showAddReview && user && rentalToReview && (
          <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={!canReview}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Write a Review
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Review {gpu.name}</DialogTitle>
                <DialogDescription>
                  Share your experience with this GPU to help other renters make informed decisions.
                </DialogDescription>
              </DialogHeader>
              <ReviewForm
                gpuId={gpu.id}
                rentalId={rentalToReview.id}
                onSubmit={handleSubmitReview}
                isSubmitting={submitReviewMutation.isPending}
                className="mt-4"
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <ReviewList
        reviews={reviews}
        isLoading={isLoadingReviews}
        emptyMessage="No reviews for this GPU yet. Be the first to share your experience!"
      />
    </div>
  );
}