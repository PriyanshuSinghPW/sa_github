document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '0';
    canvas.style.pointerEvents = 'none';
    document.body.appendChild(canvas);

    let width, height;
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;
    
    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        // Center mouse initially
        mouseX = width / 2;
        mouseY = height / 2;
    }
    
    window.addEventListener('resize', resize);
    resize();

    // Track mouse for parallax
    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    // Configuration
    const ORB_COUNT = 15;
    const STAR_COUNT = 100;

    class Orb {
        constructor() {
            this.reset(true);
        }

        reset(initial = false) {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            // Slower, smoother movement
            this.vx = (Math.random() - 0.5) * 0.2;
            this.vy = (Math.random() - 0.5) * 0.2;
            this.radius = Math.random() * 150 + 100; 
            // Increased visibility
            this.baseAlpha = Math.random() * 0.2 + 0.1; 
            // Cyan and Purple palette
            this.color = Math.random() > 0.5 ? '0, 242, 255' : '112, 0, 255'; 
            this.phase = Math.random() * Math.PI * 2;
            this.parallaxFactor = 0.05; // Orbs move more (closer)
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.phase += 0.005;

            // Wrap around screen
            if (this.x < -this.radius) this.x = width + this.radius;
            if (this.x > width + this.radius) this.x = -this.radius;
            if (this.y < -this.radius) this.y = height + this.radius;
            if (this.y > height + this.radius) this.y = -this.radius;
        }

        draw(offsetX, offsetY) {
            const alpha = this.baseAlpha + Math.sin(this.phase) * 0.02;
            const gradient = ctx.createRadialGradient(
                this.x + offsetX * this.parallaxFactor, 
                this.y + offsetY * this.parallaxFactor, 
                0, 
                this.x + offsetX * this.parallaxFactor, 
                this.y + offsetY * this.parallaxFactor, 
                this.radius
            );
            gradient.addColorStop(0, `rgba(${this.color}, ${alpha})`);
            gradient.addColorStop(1, `rgba(${this.color}, 0)`);
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(
                this.x + offsetX * this.parallaxFactor, 
                this.y + offsetY * this.parallaxFactor, 
                this.radius, 0, Math.PI * 2
            );
            ctx.fill();
        }
    }

    class Star {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            // Increased size for visibility
            this.size = Math.random() * 2 + 0.5; 
            this.alpha = Math.random();
            this.fadeSpeed = (Math.random() * 0.01 + 0.002) * (Math.random() > 0.5 ? 1 : -1);
            this.parallaxFactor = 0.02; // Stars move less (further)
        }

        update() {
            this.alpha += this.fadeSpeed;
            if (this.alpha > 1) {
                this.alpha = 1;
                this.fadeSpeed *= -1;
            } else if (this.alpha < 0) {
                this.alpha = 0;
                this.fadeSpeed *= -1;
                if (Math.random() > 0.5) {
                    this.x = Math.random() * width;
                    this.y = Math.random() * height;
                }
            }
        }

        draw(offsetX, offsetY) {
            // Increased opacity
            ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
            ctx.beginPath();
            ctx.arc(
                this.x + offsetX * this.parallaxFactor, 
                this.y + offsetY * this.parallaxFactor, 
                this.size, 0, Math.PI * 2
            );
            ctx.fill();
        }
    }

    const orbs = Array.from({ length: ORB_COUNT }, () => new Orb());
    const stars = Array.from({ length: STAR_COUNT }, () => new Star());

    function animate() {
        ctx.clearRect(0, 0, width, height);
        
        // Calculate smooth parallax offset
        // Mouse left -> positive offset (move right)
        // Mouse right -> negative offset (move left)
        const targetOffsetX = (width / 2 - mouseX);
        const targetOffsetY = (height / 2 - mouseY);
        
        targetX += (targetOffsetX - targetX) * 0.05;
        targetY += (targetOffsetY - targetY) * 0.05;

        // Use screen blending for glowing effect
        ctx.globalCompositeOperation = 'screen';
        
        orbs.forEach(orb => {
            orb.update();
            orb.draw(targetX, targetY);
        });

        // Reset blending for stars
        ctx.globalCompositeOperation = 'source-over';
        
        stars.forEach(star => {
            star.update();
            star.draw(targetX, targetY);
        });
        
        requestAnimationFrame(animate);
    }

    animate();
});
