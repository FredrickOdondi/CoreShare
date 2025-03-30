import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card";
import { Avatar } from "../ui/avatar";
import { ScrollArea } from "../ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type SessionResponse = {
  sessionId: string;
};

export default function ChatWithCori() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

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

  // Message mutation
  const messageMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: (botResponse) => {
      setMessages((prev) => [...prev, botResponse]);
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