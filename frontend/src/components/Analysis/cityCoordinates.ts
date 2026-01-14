// This file provides a static mapping from city/location names to their latitude and longitude.
// Add more cities as needed for your dataset.


const cityCoordinates: Record<string, [number, number]> = {
  // NCR/Delhi
  "New Delhi": [28.6139, 77.2090],
  "Delhi": [28.6139, 77.2090],
  "Delhi NCR": [28.6139, 77.2090],
  // Major Metros
  "Mumbai": [19.0760, 72.8777],
  "Bombay": [19.0760, 72.8777],
  "Bangalore": [12.9716, 77.5946],
  "Bengaluru": [12.9716, 77.5946],
  "Chennai": [13.0827, 80.2707],
  "Kolkata": [22.5726, 88.3639],
  "Calcutta": [22.5726, 88.3639],
  "Hyderabad": [17.3850, 78.4867],
  "Pune": [18.5204, 73.8567],
  "Ahmedabad": [23.0225, 72.5714],
  "Jaipur": [26.9124, 75.7873],
  "Lucknow": [26.8467, 80.9462],
  "Kanpur": [26.4499, 80.3319],
  "Nagpur": [21.1458, 79.0882],
  "Indore": [22.7196, 75.8577],
  "Bhopal": [23.2599, 77.4126],
  // Hill stations and tourist
  "Dalhousie": [32.5420, 75.9810],
  "Shimla": [31.1048, 77.1734],
  "Manali": [32.2396, 77.1887],
  "Mussoorie": [30.4599, 78.0662],
  "Nainital": [29.3919, 79.4542],
  "Darjeeling": [27.0360, 88.2627],
  // Jammu & Kashmir
  "Jammu": [32.7266, 74.8570],
  "Katra": [32.9910, 74.9380],
  "Jammu, Katra": [32.9910, 74.9380],
  "Srinagar": [34.0837, 74.7973],
  // South India
  "Thiruvananthapuram": [8.5241, 76.9366],
  "Kochi": [9.9312, 76.2673],
  "Coimbatore": [11.0168, 76.9558],
  "Madurai": [9.9252, 78.1198],
  // Punjab & North
  "Amritsar": [31.6340, 74.8723],
  "Ludhiana": [30.9000, 75.8573],
  "Chandigarh": [30.7333, 76.7794],
  // East & North-East
  "Patna": [25.5941, 85.1376],
  "Ranchi": [23.3441, 85.3096],
  "Guwahati": [26.1445, 91.7362],
  "Shillong": [25.5788, 91.8933],
  // Central India
  "Raipur": [21.2514, 81.6296],
  "Jabalpur": [23.1815, 79.9864],
  // International / common travel locations
  "Thailand": [15.8700, 100.9925],
  "Bangkok": [13.7563, 100.5018],
  // Add more Indian cities as needed
};

export default cityCoordinates;
