let bg; function preload(){ bg=loadImage('assets/advent-image.png'); }
function setup(){ createCanvas(bg.width,bg.height).parent('canvas-container'); }
function draw(){ image(bg,0,0); }