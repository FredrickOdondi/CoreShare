import { Review } from "@shared/schema";
import { format } from "date-fns";
import { StarRating } from "./star-rating";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ReviewListProps {
  reviews: Review[];
  isLoading?: boolean;
  maxHeight?: string;
  emptyMessage?: string;
  className?: string;
}

export function ReviewList({
  reviews,
  isLoading = false,
  maxHeight = "400px",
  emptyMessage = "No reviews yet",
  className,
}: ReviewListProps) {
  if (isLoading) {
    return (
      <div className={className}>
        {[1, 2, 3].map((item) => (
          <ReviewSkeleton key={item} />
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ScrollArea className={className} style={{ maxHeight }}>
      <div className="space-y-4">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
    </ScrollArea>
  );
}

interface ReviewCardProps {
  review: Review;
}

function ReviewCard({ review }: ReviewCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-sm font-medium">
              {review.reviewerName || "Anonymous"}
            </CardTitle>
            <CardDescription className="text-xs">
              {review.createdAt && format(new Date(review.createdAt), "PPP")}
            </CardDescription>
          </div>
          <StarRating value={review.rating} size="sm" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm">{review.comment || "No comment provided."}</p>
      </CardContent>
    </Card>
  );
}

function ReviewSkeleton() {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16 mt-1" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4 mt-1" />
      </CardContent>
    </Card>
  );
}