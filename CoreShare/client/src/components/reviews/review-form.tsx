import { useState } from "react";
import { z } from "zod";
import { UseFormReturn, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { StarRating } from "./star-rating";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { InsertReview, insertReviewSchema } from "@shared/schema";

const reviewFormSchema = insertReviewSchema.extend({
  // Additional custom validation
  rating: z.number().min(1, "Rating is required").max(5, "Maximum rating is 5 stars"),
  comment: z.string().min(3, "Comment is too short").max(500, "Comment is too long"),
});

type ReviewFormValues = z.infer<typeof reviewFormSchema>;

interface ReviewFormProps {
  gpuId: number;
  rentalId: number;
  onSubmit: (data: InsertReview) => void;
  isSubmitting?: boolean;
  className?: string;
}

export function ReviewForm({
  gpuId,
  rentalId,
  onSubmit,
  isSubmitting = false,
  className,
}: ReviewFormProps) {
  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      rating: 0,
      comment: "",
      gpuId,
      rentalId,
      reviewerId: 0, // This will be set by the server
    },
  });

  const handleFormSubmit = (values: ReviewFormValues) => {
    onSubmit(values);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleFormSubmit)}
        className={className}
      >
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="rating"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rating</FormLabel>
                <FormControl>
                  <RatingPicker
                    value={field.value}
                    onChange={field.onChange}
                    form={form}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="comment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Review</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Share your experience with this GPU..."
                    {...field}
                    className="resize-none min-h-[100px]"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? "Submitting..." : "Submit Review"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

interface RatingPickerProps {
  value: number;
  onChange: (value: number) => void;
  form: UseFormReturn<ReviewFormValues>;
}

function RatingPicker({ value, onChange, form }: RatingPickerProps) {
  const [hoverRating, setHoverRating] = useState<number>(0);

  return (
    <div className="flex items-center space-x-2">
      <div
        className="relative"
        onMouseLeave={() => setHoverRating(0)}
      >
        <StarRating
          value={hoverRating || value}
          readOnly={false}
          onChange={onChange}
          size="lg"
        />
        
        {/* Display current rating next to stars */}
        <div className="ml-2 text-sm text-muted-foreground inline-block">
          {value > 0 ? `${value} stars` : "Click to rate"}
        </div>
      </div>
    </div>
  );
}