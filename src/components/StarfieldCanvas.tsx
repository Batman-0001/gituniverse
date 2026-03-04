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
        const count = Math.min(800, Math.floor((width * height) / 2000));

        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                z: Math.random() * 3 + 0.5,
                size: Math.random() * 2 + 0.3,
                opacity: Math.random() * 0.8 + 0.2,
                speed: Math.random() * 0.3 + 0.05,
                hue: Math.random() > 0.85 ? Math.random() * 60 + 200 : 0,
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

        let time = 0;

        const animate = () => {
            time += 0.01;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (const star of starsRef.current) {
                // Subtle parallax from mouse
                const parallaxX = (mouseRef.current.x - canvas.width / 2) * 0.01 * star.z;
                const parallaxY = (mouseRef.current.y - canvas.height / 2) * 0.01 * star.z;

                const x = star.x + parallaxX;
                const y = star.y + parallaxY;

                // Twinkling
                const twinkle = Math.sin(time * star.speed * 10 + star.x) * 0.3 + 0.7;
                const alpha = star.opacity * twinkle;

                ctx.beginPath();

                if (star.hue > 0) {
                    // Colored stars (blue-ish)
                    ctx.fillStyle = `hsla(${star.hue}, 80%, 75%, ${alpha})`;
                    ctx.shadowColor = `hsla(${star.hue}, 80%, 75%, ${alpha * 0.5})`;
                    ctx.shadowBlur = star.size * 4;
                } else {
                    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                    ctx.shadowColor = `rgba(255, 255, 255, ${alpha * 0.3})`;
                    ctx.shadowBlur = star.size * 2;
                }

                ctx.arc(x, y, star.size * star.z * 0.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            // Draw subtle nebula blobs
            const nebulaCount = 3;
            for (let i = 0; i < nebulaCount; i++) {
                const nx = canvas.width * (0.2 + i * 0.3) + Math.sin(time * 0.2 + i) * 50;
                const ny = canvas.height * (0.3 + i * 0.15) + Math.cos(time * 0.15 + i * 2) * 30;
                const gradient = ctx.createRadialGradient(nx, ny, 0, nx, ny, 200);

                const hue = [260, 200, 320][i];
                gradient.addColorStop(0, `hsla(${hue}, 60%, 30%, 0.05)`);
                gradient.addColorStop(0.5, `hsla(${hue}, 50%, 20%, 0.02)`);
                gradient.addColorStop(1, "transparent");

                ctx.fillStyle = gradient;
                ctx.fillRect(nx - 200, ny - 200, 400, 400);
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
