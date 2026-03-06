import itertools

def solve_tsp(distance_matrix, duration_matrix, start_node=0):
    """
    Solves the Traveling Salesperson Problem purely using brute force permutations.
    This is exact but only suitable for a small number of nodes (N <= 10).
    For delivery route optimization on a map MVP, we usually assume a small number of inputs.
    
    Args:
        distance_matrix: 2D list of distances between nodes
        duration_matrix: 2D list of durations between nodes
        start_node: The starting index (usually 0)
        
    Returns:
        tuple: (best_route, total_distance, total_duration)
    """
    n = len(distance_matrix)
    
    if n <= 1:
        return [0], 0, 0
        
    # The nodes to visit, excluding the start node
    nodes_to_visit = list(range(n))
    nodes_to_visit.remove(start_node)
    
    min_distance = float('inf')
    best_path = None
    best_duration = 0
    
    # Generate all permutations of the remaining nodes
    for perm in itertools.permutations(nodes_to_visit):
        current_distance = 0
        current_duration = 0
        current_node = start_node
        
        valid_path = True
        for next_node in perm:
            dist = distance_matrix[current_node][next_node]
            if dist == float('inf'):
                valid_path = False
                break
                
            current_distance += dist
            current_duration += duration_matrix[current_node][next_node]
            current_node = next_node
            
        # Add distance back to start node as it's a closed loop for the warehouse.
        current_distance += distance_matrix[current_node][start_node]
        current_duration += duration_matrix[current_node][start_node]
            
        if valid_path and current_distance < min_distance:
            min_distance = current_distance
            # Add start_node to the end of the path
            best_path = [start_node] + list(perm) + [start_node]
            best_duration = current_duration
            
    # Default fallback if no path found
    if best_path is None:
        best_path = list(range(n)) + [start_node]
        min_distance = 0
        best_duration = 0
        for i in range(len(best_path) - 1):
            min_distance += distance_matrix[best_path[i]][best_path[i+1]]
            best_duration += duration_matrix[best_path[i]][best_path[i+1]]
            
    return best_path, min_distance, best_duration
