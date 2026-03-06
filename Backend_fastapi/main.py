import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import googlemaps
from googlemaps import convert
from dotenv import load_dotenv
from tsp_solver import solve_tsp

load_dotenv()

app = FastAPI(title="Delivery Route Optimization API")

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Google Maps client
api_key = os.getenv("GOOGLE_MAPS_API_KEY")
if not api_key:
    print("WARNING: GOOGLE_MAPS_API_KEY environment variable not set.")
try:
    gmaps_client = googlemaps.Client(key=api_key) if api_key else None
except Exception as e:
    print(f"Error initializing Google Maps client: {e}")
    gmaps_client = None

class Location(BaseModel):
    id: str
    lat: float
    lng: float
    address: str = ""

class OptimizeRequest(BaseModel):
    locations: List[Location]
    travel_mode: str = "driving" # can be "driving", "two_wheeler"

class RouteResponse(BaseModel):
    optimized_locations: List[Location]
    total_distance_meters: int
    total_duration_seconds: int
    route_order: List[int]

@app.post("/api/optimize-route", response_model=RouteResponse)
async def optimize_route(request: OptimizeRequest):
    locations = request.locations
    
    if not locations:
        raise HTTPException(status_code=400, detail="No locations provided")
    
    if len(locations) == 1:
        return RouteResponse(
            optimized_locations=locations,
            total_distance_meters=0,
            total_duration_seconds=0,
            route_order=[0]
        )
        
    if not gmaps_client:
        raise HTTPException(status_code=500, detail="Google Maps API key not configured")

    # Format origins and destinations for the distance matrix API
    # the format requires tuples of (lat, lng) or just the string address
    # Since we are taking lat/lng from frontend map, we use them directly
    coords = [(loc.lat, loc.lng) for loc in locations]
    
    try:
        # Get distance matrix from Google Maps API
        # We need the full N x N matrix
        # We bypass distance_matrix() and use _request() directly because the googlemaps 
        # python library validation is outdated and blocks "two_wheeler" mode.
        params = {
            "origins": convert.location_list(coords),
            "destinations": convert.location_list(coords),
            "mode": request.travel_mode
        }
        matrix_result = gmaps_client._request("/maps/api/distancematrix/json", params)
        
        # Check if API request was successful
        if matrix_result.get("status") != "OK":
            print("Distance Matrix Error:", matrix_result)
            raise HTTPException(status_code=500, detail=f"Google Maps API error: {matrix_result.get('status')}")
            
        rows = matrix_result.get("rows", [])
        
        # Debugging elements
        for i, row in enumerate(rows):
            elements = row.get("elements", [])
            for j, element in enumerate(elements):
                if element.get("status") != "OK":
                     print(f"Element [{i}][{j}] status:", element.get("status"))
        
        # Build the distance matrix (N x N)
        n = len(locations)
        distance_matrix = [[0] * n for _ in range(n)]
        duration_matrix = [[0] * n for _ in range(n)]
        
        for i, row in enumerate(rows):
            elements = row.get("elements", [])
            for j, element in enumerate(elements):
                status = element.get("status")
                if status == "OK":
                    distance_matrix[i][j] = element.get("distance", {}).get("value", 0)  # in meters
                    duration_matrix[i][j] = element.get("duration", {}).get("value", 0)  # in seconds
                else:
                    # If route is not found, set to a very large number
                    distance_matrix[i][j] = float('inf')
                    duration_matrix[i][j] = float('inf')
                    
        # Assume start location is the first element
        # We need to find the shortest path visiting all points and returning to start (standard TSP)
        # or just visiting all points (Hamiltonian path). 
        # For typical delivery, it could be a round trip, or an open path. 
        # Let's solve the asymmetric TSP starting at 0, passing through all, and optionally returning to 0.
        # We'll use a TSP solver that just visits all nodes.
        best_route, total_distance, total_duration = solve_tsp(distance_matrix, duration_matrix, start_node=0)
        
        if total_distance == float('inf') or total_duration == float('inf'):
            raise HTTPException(
                status_code=400, 
                detail="Could not find a valid route connecting all locations for the selected travel mode."
            )
        
        # Reorder locations based on best_route
        optimized_locations = [locations[i] for i in best_route]
        
        return RouteResponse(
            optimized_locations=optimized_locations,
            total_distance_meters=total_distance,
            total_duration_seconds=total_duration,
            route_order=best_route
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "ok"}
