import "./globals.css";

export const metadata = {
  title: "Productivity Tracker",
  description: "Chat-first team EOD & productivity tracker",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
