#!/usr/bin/env python3
"""
Test script to verify model and database compatibility
"""

from app.models.traffic import TrafficMonitoring
from app.db import SessionLocal
from sqlalchemy import text

def test_model_database():
    """Test if the model works with the current database"""
    try:
        print("🔍 Testing model and database compatibility...")
        
        # Create a database session
        db = SessionLocal()
        
        # Test 1: Check if we can query the table
        print("📋 Test 1: Basic table query...")
        result = db.execute(text("SELECT COUNT(*) FROM traffic_monitoring"))
        count = result.fetchone()[0]
        print(f"  ✅ Table exists, {count} records")
        
        # Test 2: Check table schema
        print("📋 Test 2: Table schema...")
        result = db.execute(text("PRAGMA table_info(traffic_monitoring)"))
        columns = result.fetchall()
        column_names = [col[1] for col in columns]
        print(f"  ✅ Columns: {column_names}")
        
        # Test 3: Try to create a model instance
        print("📋 Test 3: Model instance creation...")
        test_traffic = TrafficMonitoring(
            road_name="Test Road",
            road_type="main_road",
            latitude=14.4500,
            longitude=121.0100,
            barangay="Test Barangay",
            traffic_status="free_flow",
            average_speed_kmh=50.0,
            vehicle_count=10,
            congestion_percentage=20.0,
            estimated_travel_time=5.0,
            road_segment_length=1.0,
            data_source="test",
            confidence_score=1.0
        )
        print("  ✅ Model instance created successfully")
        
        # Test 4: Try to add to database
        print("📋 Test 4: Database insertion...")
        db.add(test_traffic)
        db.commit()
        print("  ✅ Record inserted successfully")
        
        # Test 5: Try to query using SQLAlchemy model
        print("📋 Test 5: SQLAlchemy model query...")
        traffic_records = db.query(TrafficMonitoring).all()
        print(f"  ✅ Query successful, {len(traffic_records)} records found")
        
        # Test 6: Try to query with filters
        print("📋 Test 6: Filtered query...")
        filtered_records = db.query(TrafficMonitoring).filter(
            TrafficMonitoring.latitude.between(14.4, 14.5)
        ).all()
        print(f"  ✅ Filtered query successful, {len(filtered_records)} records found")
        
        db.close()
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main function"""
    print("🛠️  Model and Database Compatibility Test")
    print("=" * 50)
    
    success = test_model_database()
    
    if success:
        print("\n✅ All tests passed! Model and database are compatible.")
    else:
        print("\n❌ Tests failed! There's a compatibility issue.")

if __name__ == "__main__":
    main()
