"""
API views for the trip planning endpoint.
"""
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from . import services


@api_view(['POST'])
def plan_trip(request):
    """
    POST /api/trip/plan/
    
    Body:
    {
        "current_location": "Chicago, IL",
        "pickup_location": "Indianapolis, IN",
        "dropoff_location": "Nashville, TN",
        "current_cycle_used": 20
    }
    """
    data = request.data

    # Validate inputs
    current_location = data.get('current_location', '').strip()
    pickup_location = data.get('pickup_location', '').strip()
    dropoff_location = data.get('dropoff_location', '').strip()
    current_cycle_used = data.get('current_cycle_used', 0)

    errors = []
    if not current_location:
        errors.append("Current location is required.")
    if not pickup_location:
        errors.append("Pickup location is required.")
    if not dropoff_location:
        errors.append("Dropoff location is required.")

    try:
        current_cycle_used = float(current_cycle_used)
        if current_cycle_used < 0:
            errors.append("Current cycle used must be non-negative.")
        if current_cycle_used >= 70:
            errors.append("Current cycle used must be less than 70 hours.")
    except (TypeError, ValueError):
        errors.append("Current cycle used must be a valid number.")

    if errors:
        return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

    # Plan the trip
    try:
        result = services.plan_trip(
            current_location_text=current_location,
            pickup_location_text=pickup_location,
            dropoff_location_text=dropoff_location,
            current_cycle_used=current_cycle_used,
        )
        return Response(result, status=status.HTTP_200_OK)
    except ValueError as e:
        return Response(
            {"errors": [str(e)]},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as e:
        return Response(
            {"errors": [f"An error occurred while planning the trip: {str(e)}"]},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
