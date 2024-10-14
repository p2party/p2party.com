export interface Message {
  id: number;
  text: string;
  sender: string;
  avatarUrl: string;
  replyTo: number | null;
}

export const getRandomMessages = (): Message[] => {
  return [
    {
      id: 1,
      text: "Hey! Have you seen the new update?",
      sender: "other",
      avatarUrl: "https://example.com/avatar1.png",
      replyTo: null, // Initial message
    },
    {
      id: 2,
      text: "Yeah, I just checked it out. It's awesome!",
      sender: "user",
      avatarUrl: "https://example.com/avatar2.png",
      replyTo: 1, // Replying to message 1
    },
    {
      id: 3,
      text: "Glad to hear! What do you think about the new feature?",
      sender: "other",
      avatarUrl: "https://example.com/avatar1.png",
      replyTo: 2, // Replying to message 2
    },
    {
      id: 4,
      text: "I think it's going to be super helpful for our workflow.",
      sender: "user",
      avatarUrl: "https://example.com/avatar2.png",
      replyTo: 3, // Replying to message 3
    },
    {
      id: 5,
      text: "Totally agree, it was something we needed for a while.",
      sender: "other",
      avatarUrl: "https://example.com/avatar1.png",
      replyTo: 4, // Replying to message 4
    },
    {
      id: 6,
      text: "By the way, are you available for a quick call later today?",
      sender: "other",
      avatarUrl: "https://example.com/avatar1.png",
      replyTo: null, // New conversation, not a reply
    },
    {
      id: 7,
      text: "Sure, what time works for you?",
      sender: "user",
      avatarUrl: "https://example.com/avatar2.png",
      replyTo: 6, // Replying to message 6
    },
    {
      id: 8,
      text: "How about 3 PM? We can discuss the project roadmap then.",
      sender: "other",
      avatarUrl: "https://example.com/avatar1.png",
      replyTo: 7, // Replying to message 7
    },
    {
      id: 9,
      text: "3 PM works! I'll prepare a few points for discussion.",
      sender: "user",
      avatarUrl: "https://example.com/avatar2.png",
      replyTo: 8, // Replying to message 8
    },
    {
      id: 10,
      text: "Great! Looking forward to it.",
      sender: "other",
      avatarUrl: "https://example.com/avatar1.png",
      replyTo: 9, // Replying to message 9
    },
    {
      id: 11,
      text: "Also, have you checked out the new API documentation?",
      sender: "user",
      avatarUrl: "https://example.com/avatar2.png",
      replyTo: null, // New conversation, not a reply
    },
    {
      id: 12,
      text: "Not yet, is it much different from the previous version?",
      sender: "other",
      avatarUrl: "https://example.com/avatar1.png",
      replyTo: 11, // Replying to message 11
    },
    {
      id: 13,
      text: "Yes, they've added a few new endpoints and improved the examples.",
      sender: "user",
      avatarUrl: "https://example.com/avatar2.png",
      replyTo: 12, // Replying to message 12
    },
    {
      id: 14,
      text: "Sounds good! I'll check it out before our call.",
      sender: "other",
      avatarUrl: "https://example.com/avatar1.png",
      replyTo: 13, // Replying to message 13
    },
  ];
};
