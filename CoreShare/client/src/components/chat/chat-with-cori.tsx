import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card";
import { Avatar } from "../ui/avatar";
import { ScrollArea } from "../ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/use-theme";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type SessionResponse = {
  sessionId: string;
};

// Interface for creating a GPU listing
interface CreateGpuRequest {
  name: string;
  manufacturer: string;
  vram: number;
  pricePerHour: number;
  technicalSpecs?: Record<string, any>;
}

// GPU creation response
interface CreateGpuResponse {
  success: boolean;
  message: string;
  gpuId?: number;
}

export default function ChatWithCori() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { toggleTheme } = useTheme();
  const queryClient = useQueryClient();

  // Create a new chat session
  const createSession = async (): Promise<string> => {
    try {
      const response = await apiRequest("POST", "/api/chat/session");
      const data = await response.json() as SessionResponse;
      return data.sessionId;
    } catch (error) {
      console.error("Error creating chat session:", error);
      throw error;
    }
  };

  // Get chat history for a session
  const getChatHistory = async (sid: string): Promise<Message[]> => {
    try {
      const response = await apiRequest("GET", `/api/chat/session/${sid}`);
      const data = await response.json();
      return data as Message[];
    } catch (error) {
      console.error("Error fetching chat history:", error);
      throw error;
    }
  };

  // Send a message to the chatbot
  const sendMessage = async ({ sessionId, message }: { sessionId: string; message: string }): Promise<Message> => {
    try {
      const response = await apiRequest("POST", "/api/chat/message", { sessionId, message });
      const data = await response.json();
      
      // Store the response object for context
      (data as any).response = response;
      
      return data as Message;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  };

  // Initialize session
  const initSession = async () => {
    try {
      // Check if we have a session ID in localStorage
      const storedSessionId = localStorage.getItem("chatSessionId");
      
      if (storedSessionId) {
        // Get chat history for existing session
        try {
          const history = await getChatHistory(storedSessionId);
          setMessages(history);
          setSessionId(storedSessionId);
        } catch (error) {
          // If session is invalid, create a new one
          const newSessionId = await createSession();
          localStorage.setItem("chatSessionId", newSessionId);
          setSessionId(newSessionId);
          setMessages([]);
        }
      } else {
        // Create a new session
        const newSessionId = await createSession();
        localStorage.setItem("chatSessionId", newSessionId);
        setSessionId(newSessionId);
      }
    } catch (error) {
      console.error("Failed to initialize chat session:", error);
    }
  };

  // Setup session when component mounts
  useEffect(() => {
    if (isChatOpen && !sessionId) {
      initSession();
    }
  }, [isChatOpen]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Create a GPU listing through the chatbot
  const createGpuListing = async (data: CreateGpuRequest): Promise<CreateGpuResponse> => {
    try {
      const response = await apiRequest("POST", "/api/chat/create-gpu", data);
      return await response.json() as CreateGpuResponse;
    } catch (error) {
      console.error("Error creating GPU listing:", error);
      throw error;
    }
  };

  // GPU creation mutation
  const gpuCreateMutation = useMutation({
    mutationFn: createGpuListing,
    onSuccess: (response) => {
      if (response.success) {
        // Show success toast
        toast({
          title: "GPU Listing Created",
          description: response.message,
          variant: "default",
        });
        
        // Refetch GPUs to update the list
        queryClient.invalidateQueries({ queryKey: ["gpus"] });
        
        // Add a system message to the chat
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: `✅ ${response.message} You can now find it in your GPU listings. Is there anything else you'd like to do?`,
            timestamp: new Date(),
          },
        ]);
      } else {
        // Show error toast
        toast({
          title: "GPU Creation Failed",
          description: response.message,
          variant: "destructive",
        });
        
        // Add failure message to chat
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: `⚠️ ${response.message} Please check the information and try again.`,
            timestamp: new Date(),
          },
        ]);
      }
    },
    onError: (error) => {
      console.error("Error creating GPU:", error);
      toast({
        title: "Error",
        description: "Failed to create GPU listing. Please try again later.",
        variant: "destructive",
      });
      
      // Add error message to chat
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "I encountered an error while trying to create your GPU listing. Please try again later.",
          timestamp: new Date(),
        },
      ]);
    },
  });

  // Message mutation
  const messageMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: (botResponse, variables, context) => {
      setMessages((prev) => [...prev, botResponse]);
      
      // Check if there's a theme toggle action in the headers
      const response = (botResponse as any).response as Response;
      if (response?.headers?.get('X-Theme-Action') === 'toggle') {
        // Toggle theme when requested
        console.log("Theme toggle requested by Cori");
        toggleTheme();
        
        // Show toast notification
        toast({
          title: "Theme Changed",
          description: "Theme has been toggled by Cori",
        });
      }
      
      // Check for potential GPU listing creation instructions in the bot response
      const content = botResponse.content.toLowerCase();
      
      // If the bot seems to be confirming a GPU creation - expanded patterns for better detection
      if ((content.includes("creating") && content.includes("gpu") && (content.includes("listing") || content.includes("one moment"))) ||
          (content.includes("successfully") && content.includes("created") && content.includes("gpu")) ||
          (content.includes("adding") && content.includes("gpu") && content.includes("marketplace")) ||
          (content.includes("proceed") && content.includes("creating") && content.includes("listing")) ||
          (content.includes("would you like me to add") && content.includes("gpu")) ||
          (content.includes("should i create a listing") && content.includes("gpu")) ||
          (content.includes("add it to the marketplace")) ||
          (content.includes("i can add this gpu") && content.includes("for you"))) {
        
        console.log("Detected potential GPU creation message from Cori");
        
        // First check if user is logged in
        if (!user) {
          console.warn("Cannot create GPU: User not logged in");
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: "You need to be logged in to create GPU listings. Please log in and try again.",
              timestamp: new Date(),
            },
          ]);
          return;
        }
        
        // Then try to extract GPU data
        const gpuData = extractGpuDataFromMessages([...messages, botResponse]);
        if (gpuData) {
          console.log("Extracted GPU data:", gpuData);
          // Log the extracted data to help debug
          console.log("Name:", gpuData.name);
          console.log("Manufacturer:", gpuData.manufacturer);
          console.log("VRAM:", gpuData.vram);
          console.log("Price per hour:", gpuData.pricePerHour);
          console.log("Technical specs:", gpuData.technicalSpecs);
          
          gpuCreateMutation.mutate(gpuData);
        } else {
          console.warn("Could not extract complete GPU data from conversation");
          // Add a fallback message to ask for more specific details
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: "I'm having trouble understanding all the details for your GPU listing. Could you please provide the information in this format? Name: [GPU name], Manufacturer: [manufacturer name], VRAM: [amount in GB], Price: [price per hour]",
              timestamp: new Date(),
            },
          ]);
        }
      }
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "Sorry, I'm having trouble responding right now. Please try again later.",
          timestamp: new Date(),
        },
      ]);
    },
  });
  
  // Helper function to extract GPU data from conversation
  const extractGpuDataFromMessages = (messages: Message[]): CreateGpuRequest | null => {
    try {
      // This is a simple implementation that looks for specific patterns
      // A production system would use more sophisticated NLP methods
      
      let name: string | null = null;
      let manufacturer: string | null = null;
      let vram: number | null = null;
      let pricePerHour: number | null = null;
      let description: string | null = null;
      let technicalSpecs: Record<string, any> = {};
      
      // Look for patterns in all messages to ensure we don't miss anything
      const recentMessages = messages;
      
      // First, try to find structured data in the last user message format: Name: X, Manufacturer: Y, etc.
      const lastUserMessage = [...recentMessages].reverse().find(msg => msg.role === 'user');
      if (lastUserMessage) {
        const content = lastUserMessage.content;
        console.log("Processing last user message:", content);
        
        // Try to extract all at once from a structured format
        const nameMatch = content.match(/name\s*:\s*([^,]+)/i);
        if (nameMatch) name = nameMatch[1].trim();
        
        const manufacturerMatch = content.match(/manufacturer\s*:\s*([^,]+)/i);
        if (manufacturerMatch) manufacturer = manufacturerMatch[1].trim();
        
        const vramMatch = content.match(/vram\s*:\s*(\d+)/i);
        if (vramMatch) vram = parseInt(vramMatch[1]);
        
        const priceMatch = content.match(/price\s*:\s*\$?(\d+\.?\d*)/i);
        if (priceMatch) pricePerHour = parseFloat(priceMatch[1]);
        
        const descMatch = content.match(/description\s*:\s*([^,]+)/i);
        if (descMatch) description = descMatch[1].trim();
      }
      
      // If we couldn't extract structured data, go through all messages
      if (!name || !manufacturer || !vram || !pricePerHour) {
        for (const msg of recentMessages) {
          const content = msg.content.toLowerCase();
          console.log("Processing message:", content.substring(0, 50) + "...");
          
          // Extract GPU name with more flexible patterns
          if (!name) {
            // Try different patterns to match GPU names like "RTX 4080 Ti", "GeForce RTX 3090", etc.
            const namePatterns = [
              /name\s*:?\s*([a-zA-Z0-9 -]+)/i,
              /gpu\s+name\s*:?\s*([a-zA-Z0-9 -]+)/i,
              /model\s*:?\s*([a-zA-Z0-9 -]+)/i,
              /gpu\s+is\s+(?:a\s+)?([a-zA-Z0-9 -]+)/i,
              /gpu\s+model\s+is\s+(?:a\s+)?([a-zA-Z0-9 -]+)/i,
              /(?:rtx|gtx|rx)\s+\d{3,4}\s*(?:ti|super)?/i
            ];
            
            for (const pattern of namePatterns) {
              const match = content.match(pattern);
              if (match) {
                name = match[1] ? match[1].trim() : match[0].trim();
                console.log("Found GPU name:", name);
                break;
              }
            }
          }
          
          // Extract manufacturer with more patterns
          if (!manufacturer) {
            const manufacturerPatterns = [
              /manufacturer\s*:?\s*([a-zA-Z0-9 ]+)/i,
              /made by\s+([a-zA-Z0-9 ]+)/i,
              /from\s+([a-zA-Z0-9 ]+)/i,
              /brand\s*:?\s*([a-zA-Z0-9 ]+)/i,
              /(?:nvidia|amd|intel)/i
            ];
            
            for (const pattern of manufacturerPatterns) {
              const match = content.match(pattern);
              if (match) {
                manufacturer = match[1] ? match[1].trim() : match[0].trim();
                console.log("Found manufacturer:", manufacturer);
                break;
              }
            }
            
            // Common manufacturers direct detection
            if (content.includes("nvidia")) manufacturer = "NVIDIA";
            else if (content.includes("amd")) manufacturer = "AMD";
            else if (content.includes("intel")) manufacturer = "Intel";
          }
          
          // Extract VRAM with better patterns
          if (!vram) {
            const vramPatterns = [
              /vram\s*:?\s*(\d+)/i,
              /(\d+)\s*gb\s+(?:of\s+)?vram/i,
              /(\d+)\s*gb\s+memory/i,
              /memory\s*:?\s*(\d+)/i,
              /vram.*?(\d+)\s*gb/i,
              /memory.*?(\d+)\s*gb/i,
              /(\d+)\s*gb/i
            ];
            
            for (const pattern of vramPatterns) {
              const match = content.match(pattern);
              if (match) {
                vram = parseInt(match[1]);
                console.log("Found VRAM:", vram);
                break;
              }
            }
          }
          
          // Extract price with better patterns
          if (!pricePerHour) {
            const pricePatterns = [
              /price\s*:?\s*\$?(\d+\.?\d*)/i,
              /price per hour\s*:?\s*\$?(\d+\.?\d*)/i,
              /(\d+\.?\d*)\s*per\s*hour/i,
              /\$(\d+\.?\d*)\s*\/\s*hour/i,
              /(\d+\.?\d*)\s*dollars/i,
              /cost\s*:?\s*\$?(\d+\.?\d*)/i,
              /rate\s*:?\s*\$?(\d+\.?\d*)/i,
              /\$(\d+\.?\d*)/i
            ];
            
            for (const pattern of pricePatterns) {
              const match = content.match(pattern);
              if (match) {
                pricePerHour = parseFloat(match[1]);
                console.log("Found price:", pricePerHour);
                break;
              }
            }
          }
          
          // Extract description
          if (!description) {
            const descPatterns = [
              /description\s*:?\s*(.+?)(?=\.|$)/i,
              /about\s+(?:the\s+)?gpu\s*:?\s*(.+?)(?=\.|$)/i
            ];
            
            for (const pattern of descPatterns) {
              const match = content.match(pattern);
              if (match) {
                description = match[1].trim().substring(0, 255);
                console.log("Found description:", description);
                break;
              }
            }
          }
          
          // Extract technical specs
          const cudaCoresMatch = content.match(/cuda\s+cores\s*:?\s*(\d+)/i) || 
                                content.match(/cores\s*:?\s*(\d+)/i);
          if (cudaCoresMatch) technicalSpecs.cudaCores = parseInt(cudaCoresMatch[1]);
          
          const baseClockMatch = content.match(/base\s+clock\s*:?\s*(\d+\.?\d*)/i) || 
                                content.match(/clock\s+speed\s*:?\s*(\d+\.?\d*)/i);
          if (baseClockMatch) technicalSpecs.baseClock = parseFloat(baseClockMatch[1]);
          
          const boostClockMatch = content.match(/boost\s+clock\s*:?\s*(\d+\.?\d*)/i) || 
                                content.match(/(?:boost|turbo)\s+speed\s*:?\s*(\d+\.?\d*)/i);
          if (boostClockMatch) technicalSpecs.boostClock = parseFloat(boostClockMatch[1]);
          
          const tdpMatch = content.match(/tdp\s*:?\s*(\d+)/i) || 
                          content.match(/power\s+consumption\s*:?\s*(\d+)/i);
          if (tdpMatch) technicalSpecs.tdp = parseInt(tdpMatch[1]);
          
          const maxTempMatch = content.match(/max\s+temp\s*:?\s*(\d+)/i) || 
                              content.match(/temperature\s+limit\s*:?\s*(\d+)/i);
          if (maxTempMatch) technicalSpecs.maxTemp = parseInt(maxTempMatch[1]);
          
          const coolingMatch = content.match(/cooling\s+system\s*:?\s*([a-zA-Z0-9 ]+)/i);
          if (coolingMatch) technicalSpecs.coolingSystem = coolingMatch[1].trim();
          
          const memoryTypeMatch = content.match(/memory\s+type\s*:?\s*([a-zA-Z0-9 ]+)/i);
          if (memoryTypeMatch) technicalSpecs.memoryType = memoryTypeMatch[1].trim();
        }
      }
      
      // Fallbacks for fields that might not have been detected correctly
      if (manufacturer) {
        // Normalize manufacturer
        if (manufacturer.toLowerCase().includes("nvidia")) manufacturer = "NVIDIA";
        else if (manufacturer.toLowerCase().includes("amd")) manufacturer = "AMD";
        else if (manufacturer.toLowerCase().includes("intel")) manufacturer = "Intel";
      }
      
      // Log final status of required fields
      console.log("Final extraction results:");
      console.log("- Name:", name);
      console.log("- Manufacturer:", manufacturer);
      console.log("- VRAM:", vram);
      console.log("- Price per hour:", pricePerHour);
      
      // If we have the minimum required data, return the GPU request
      if (name && manufacturer && vram && pricePerHour) {
        return {
          name,
          manufacturer,
          vram,
          pricePerHour,
          technicalSpecs: Object.keys(technicalSpecs).length > 0 ? technicalSpecs : undefined
        };
      } else {
        console.warn("Missing required fields for GPU creation:");
        if (!name) console.warn("- Missing name");
        if (!manufacturer) console.warn("- Missing manufacturer");
        if (!vram) console.warn("- Missing VRAM");
        if (!pricePerHour) console.warn("- Missing price per hour");
      }
      
      return null;
    } catch (error) {
      console.error("Error extracting GPU data from messages:", error);
      return null;
    }
  };

  const handleSendMessage = () => {
    if (!inputValue.trim() || !sessionId) return;

    // Add user message to chat
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    
    // Send to API
    messageMutation.mutate({ 
      sessionId, 
      message: inputValue.trim() 
    });
    
    // Clear input
    setInputValue("");
    
    // Focus input again
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isChatOpen ? (
        <Button 
          onClick={toggleChat} 
          className="rounded-full w-12 h-12 shadow-lg flex items-center justify-center"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="h-6 w-6"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </Button>
      ) : (
        <Card className="w-80 md:w-96 h-[500px] shadow-xl flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
            <CardTitle className="text-xl flex items-center">
              <Avatar className="h-8 w-8 mr-2">
                <span>C</span>
              </Avatar>
              Chat with Cori
            </CardTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleChat}
              className="h-7 w-7"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </Button>
          </CardHeader>
          
          <CardContent className="flex-1 p-4 pt-0 overflow-hidden">
            <ScrollArea className="h-full pr-4" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-muted-foreground">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="h-12 w-12 mb-4 text-muted-foreground"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 16v-4"></path>
                    <path d="M12 8h.01"></path>
                  </svg>
                  <p>Hi! I'm Cori, your CoreShare assistant.</p>
                  <p className="mt-1">How can I help you today?</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-2 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {messageMutation.isPending && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
                        <div className="flex space-x-1">
                          <div className="h-2 w-2 rounded-full bg-current animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="h-2 w-2 rounded-full bg-current animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="h-2 w-2 rounded-full bg-current animate-bounce"></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
          
          <CardFooter className="p-4 pt-2">
            <div className="flex w-full space-x-2">
              <Input
                placeholder="Type your message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                ref={inputRef}
                disabled={!sessionId || messageMutation.isPending}
                className="flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || !sessionId || messageMutation.isPending}
                size="icon"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="h-4 w-4"
                >
                  <path d="m3 3 3 9-3 9 19-9Z"></path>
                  <path d="M6 12h16"></path>
                </svg>
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}