import React from "react";
import { Star, StarHalf } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  readOnly?: boolean;
  onChange?: (value: number) => void;
  className?: string;
}

export function StarRating({
  value,
  max = 5,
  size = "md",
  readOnly = true,
  onChange,
  className,
}: StarRatingProps) {
  // Define size values
  const sizeMap = {
    sm: { starSize: 14, className: "gap-0.5" },
    md: { starSize: 20, className: "gap-1" },
    lg: { starSize: 24, className: "gap-1.5" },
  };

  const { starSize, className: sizeClassName } = sizeMap[size];

  // Round to nearest 0.5
  const roundedValue = Math.round(value * 2) / 2;

  // Generate stars array
  const stars = Array.from({ length: max }, (_, i) => {
    const starValue = i + 1;
    const isHalfStar = roundedValue === i + 0.5;
    const isFilled = roundedValue >= starValue;

    return { starValue, isHalfStar, isFilled };
  });

  const handleClick = (starValue: number) => {
    if (readOnly || !onChange) return;
    onChange(starValue);
  };

  return (
    <div 
      className={cn(
        "flex items-center", 
        sizeClassName,
        readOnly ? "pointer-events-none" : "cursor-pointer",
        className
      )}
    >
      {stars.map(({ starValue, isHalfStar, isFilled }) => (
        <div
          key={starValue}
          className="relative"
          onClick={() => handleClick(starValue)}
        >
          {isHalfStar ? (
            <StarHalf 
              size={starSize} 
              className="text-yellow-500"
              fill="currentColor"
            />
          ) : (
            <Star
              size={starSize}
              className={isFilled ? "text-yellow-500" : "text-gray-300 dark:text-gray-600"}
              fill={isFilled ? "currentColor" : "none"}
            />
          )}
        </div>
      ))}
    </div>
  );
}