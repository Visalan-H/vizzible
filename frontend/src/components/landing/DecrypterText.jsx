import { useState, useEffect } from 'react';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';

export default function DecrypterText({ text, speed = 40, duration = 1200 }) {
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    let iteration = 0;
    const maxIterations = duration / speed;
    let interval = null;

    interval = setInterval(() => {
      setDisplayText(text.split('').map((char, index) => {
        if(char === ' ') return ' ';
        if(index < iteration / (maxIterations / text.length)) {
          return char;
        }
        return CHARS[Math.floor(Math.random() * CHARS.length)];
      }).join(''));

      if(iteration >= maxIterations) {
        clearInterval(interval);
      }
      iteration++;
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, duration]);

  return <span>{displayText}</span>;
}
