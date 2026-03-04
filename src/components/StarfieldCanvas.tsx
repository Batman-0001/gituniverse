"use client";

import React, { useRef, useEffect, useCallback } from "react";

interface Star {
    x: number;
    y: number;
    z: number;
    size: number;
    opacity: number;
    speed: number;
    hue: number;
}

export default function StarfieldCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const starsRef = useRef<Star[]>([]);
    const animationRef = useRef<number>(0);
    const mouseRef = useRef({ x: 0, y: 0 });

    const initStars = useCallback((width: number, height: number) => {
        const stars: Star[] = [];
        const count = Math.min(100, Math.floor((width * height) / 20000));

        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                z: Math.random() * 3 + 0.5,
                size: Math.random() * 1.0 + 0.2,
                opacity: Math.random() * 0.4 + 0.1,
                speed: 0,
                hue: 0,
            });
        }
        starsRef.current = stars;
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initStars(canvas.width, canvas.height);
        };

        resize();
        window.addEventListener("resize", resize);

        const handleMouse = (e: MouseEvent) => {
            mouseRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener("mousemove", handleMouse);

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (const star of starsRef.current) {
                // Subtle parallax from mouse
                const parallaxX = (mouseRef.current.x - canvas.width / 2) * 0.01 * star.z;
                const parallaxY = (mouseRef.current.y - canvas.height / 2) * 0.01 * star.z;

                const x = star.x + parallaxX;
                const y = star.y + parallaxY;

                // Static — no twinkling
                const alpha = star.opacity;

                ctx.beginPath();
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.arc(x, y, star.size * star.z * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            cancelAnimationFrame(animationRef.current);
            window.removeEventListener("resize", resize);
            window.removeEventListener("mousemove", handleMouse);
        };
    }, [initStars]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                zIndex: 0,
                pointerEvents: "none",
            }}
        />
    );
}
