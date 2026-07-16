# Rocket-Trajectory-Simulator
An interactive, browser-based rocket trajectory simulator built with real aerospace engineering math. Design your rocket, configure its parameters, and watch it fly — seeing live telemetry, orbital mechanics, and failure analysis in real time.

What This Simulates
Real rockets follow the Tsiolkovsky Rocket Equation — the fundamental equation of spaceflight:

Δv = Isp × g₀ × ln(m₀ / mf)

Where:


Δv = change in velocity (how much the rocket can accelerate)
Isp = specific impulse (engine efficiency)
g₀ = standard gravity (9.807 m/s²)
m₀ = initial mass (rocket + fuel)
mf = final mass (rocket without fuel)


This simulator models:


Thrust vs drag vs gravity at every millisecond of flight
Atmospheric drag using real density-altitude tables
Gravity turn maneuver (how real rockets pitch over after launch)
Orbital insertion — does your rocket reach orbit or fall back?
Structural failure — too much acceleration and the rocket breaks apart


Engineering Concepts Used


Tsiolkovsky Rocket Equation — fundamental equation of spaceflight
Euler integration — a numerical method for simulating physics step-by-step
Atmospheric density model — how air gets thinner as altitude increases
Drag equation — F = ½ρv²CdA (how air resistance slows the rocket)
Specific impulse (Isp) — the efficiency metric of rocket engines
Max-Q — the moment of maximum aerodynamic stress on the vehicle
Gravity turn — the pitch maneuver that gets rockets into orbit efficiently
Orbital mechanics — velocity needed to stay in orbit (7,800 m/s at LEO)



How to Run Locally

bashgit clone https://github.com/YOUR_USERNAME/rocket-sim.git
cd rocket-sim
open index.html
# or serve locally:
npx serve.

No build step. No frameworks. Pure HTML, CSS, and JavaScript — showing fundamentals.


Technologies


Vanilla HTML5, CSS3, JavaScript (ES6+)
HTML5 Canvas for real-time animation
No external dependencies — all physics written from scratch



What I Learned

BLANK




License

MIT 
