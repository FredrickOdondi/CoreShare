# AI Analysis Feature for CoreShare GPU Marketplace

## Overview

The AI Analysis feature uses machine learning algorithms to analyze GPU rental patterns and provide insights to users. This helps renters make informed decisions by showing which GPUs are most popular and what common tasks they are used for.

## Features Implemented

1. **Popularity Scoring**: Each GPU receives a popularity score (0-100) based on rental frequency
2. **Common Task Analysis**: The system identifies the most frequent tasks each GPU is used for
3. **Visual Indicators**: Color-coded badges show popularity levels (Very Popular, Popular, Moderate, Low)
4. **Task Recommendations**: GPU cards display the top 3 most common tasks that users perform

## Technical Implementation

### Database Schema

Added three fields to the GPUs table:
- `popularity_score`: INTEGER - Stores a value from 0-100 representing popularity
- `common_tasks`: TEXT - Comma-separated list of most common tasks
- `last_analyzed`: TIMESTAMP - When the analysis was last performed

### Analysis Algorithm

The analysis process works as follows:
1. Collects all rental records for each GPU
2. Calculates popularity score based on rental frequency relative to other GPUs
3. Extracts and normalizes task descriptions from rentals
4. Identifies the most frequently occurring tasks
5. Updates the GPU record with this information

### UI Components

Enhanced the GPU card component to:
- Display an "AI Analysis" section when data is available
- Show popularity as a color-coded badge (red for very popular, orange for popular, etc.)
- List common tasks in order of frequency

### Automatic Analysis

Analysis is triggered:
- Automatically after each new rental is created
- When a rental is completed
- Via an admin-only API endpoint for manual refresh

## Benefits

For GPU renters:
- Make informed decisions based on what other users are doing
- Identify the most popular GPUs for specific tasks
- Avoid under or over-provisioning by selecting the right GPU for the job

For GPU owners:
- Understand how their GPUs are being used
- Optimize their offerings based on demand
- Set more competitive pricing based on popularity

## Usage Example

When a user browses the marketplace, they can see that the NVIDIA RTX 3090 is "Very Popular" and commonly used for "Rendering, Machine Learning, Gaming". This helps them choose the right GPU for their specific workload requirements.