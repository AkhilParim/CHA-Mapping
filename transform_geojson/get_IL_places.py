import json
from pyproj import Transformer
from tqdm import tqdm  # For progress bar

# Paths to input and output files
input_file = "data/input/NDI_202_Trt_AllStates.geojson"
output_file = "data/output/NDI_202_Trt_IL_only_wgs84.geojson"

# Load GeoJSON
with open(input_file, 'r') as f:
    data = json.load(f)

# Define transformer from EPSG:3857 to EPSG:4326
transformer = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)

# Recursive function to transform coordinates
def transform_coords(coords):
    if isinstance(coords[0], list):
        return [transform_coords(c) for c in coords]
    else:
        x, y = coords
        return list(transformer.transform(x, y))

# Prepare for processing
features = data['features']
filtered_features = []

# Use tqdm to show progress
for feature in tqdm(features, desc="Processing features"):
    if feature['properties'].get('stabbr') == 'IL':
        geometry = feature.get('geometry')
        if geometry and 'coordinates' in geometry:
            # geometry['coordinates'] = transform_coords(geometry['coordinates'])
            filtered_features.append(feature)

# Save new GeoJSON
output_data = {
    "type": "FeatureCollection",
    "features": filtered_features
}

with open(output_file, 'w') as f:
    json.dump(output_data, f)

print(f"\n✅ Done! {len(filtered_features)} IL features saved to: {output_file}")
