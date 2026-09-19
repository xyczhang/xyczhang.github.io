# Bird's Eye Flight Tracker
Bird's Eye is a real-time flight tracker with a tropical island theme. Users can search up a flight by its flight number, route, or the airport board. After, they can click on the specific flight to see a map of where the flight currently is on a globe.

## How the API is Called
I used three APIs for my website: Aviationstack for general flight schedule information, ADSB.lol for live flight coordinates, and Airport-Data.com for flight paths. Only the Aviationstack API needed a key, which I made private by storing it in a private Vercel environment variable. Aviationstack is called using the endpoint /api/flights to send a GET request with the private access key parameter and some other string data types like flight_iata which gets the IATA flight number. ADSB.lol is called using the endpoint /api/position to send a GET request with key parameters being strings like the aircraft registration and ICAO24 hex code (note that ABSD.lol does not need a key). Airport-Data.com is called using the endpoint /api/route, which calls airport information in JSON that the Javascript in my code can easily read.

## How to Run
Run:

git clone https://github.com/xyczhang/xyczhang.github.io.git

cd xyczhang.github.io/vector-flight-tracker-vercel

npx vercel dev

Create a .env.local containing your own Aviationstack API key since mine is private and will not be cloned.

## Prompt Log
I used Codex to generate the code for this website along with introducing me to how Vercel works. Vercel was used to host my website and keep my API key private. In the process, I spent a lot of time figuring out how to make the Vercel work and link to the correct part of my Github repository. The following is my prompt log:

- build me a website using python that uses the aviationstack api to help people track flights and departures/arrivals
- can i use vercel instead of flask
- give me a detailed step by step of how to deploy my website on Vercel and keep the API key private
- ok great, can you make it more interactive where when the flight gets searched up and clicked on, a globe appears with where the plane is at in the world
- add a board option under airport board that is in air
- make the globe have more accurate continent outlines
- also have little birds fly around the website randomly (fly in then fly out)
- turn the cursor into a paper plane as well
