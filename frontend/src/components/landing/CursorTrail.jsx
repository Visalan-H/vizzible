import { useEffect, useRef } from 'react';

export default function CursorTrail() {
  const canvasRef = useRef(null);

  useEffect(() => {
    // Disable custom cursor follower on mobile viewports for performance & cleaner UX
    if (window.innerWidth <= 768) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let animationFrameId;
    let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let follower = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    const onMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove);
    resize();
    
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Easing logic (0.12 multiplier creates a nice smooth lag)
      follower.x += (mouse.x - follower.x) * 0.12;
      follower.y += (mouse.y - follower.y) * 0.12;
      
      const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
      // Solid clean black follower for light mode, solid white for dark mode
      ctx.fillStyle = isDarkMode ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)';
      
      // Draw a small follower circle
      ctx.beginPath();
      ctx.arc(follower.x, follower.y, 6, 0, Math.PI * 2);
      ctx.fill();
      
      animationFrameId = requestAnimationFrame(draw);
    };
    
    draw();
    
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="cursor-follower-canvas"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 9999, // Floating on top of all page elements
      }}
    />
  );
}
