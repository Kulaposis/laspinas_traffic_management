from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import List, Optional, Dict, Any
from decimal import Decimal
from datetime import datetime
import json

from ..models.parking import Parking, ParkingType, ParkingStatus
from ..models.no_parking_zone import NoParkingZone
from ..schemas.parking_schema import ParkingCreate, ParkingUpdate
from ..schemas.no_parking_zone_schema import NoParkingZoneCreate, NoParkingZoneUpdate


class ParkingService:
    def __init__(self, db: Session):
        self.db = db

    # Regular Parking Management
    def create_parking(self, parking_data: ParkingCreate) -> Parking:
        """Create a new parking area"""
        db_parking = Parking(**parking_data.dict())
        self.db.add(db_parking)
        self.db.commit()
        self.db.refresh(db_parking)
        return db_parking

    def get_parking(self, parking_id: int) -> Optional[Parking]:
        """Get parking by ID"""
        return self.db.query(Parking).filter(Parking.id == parking_id).first()

    def get_parkings(self, skip: int = 0, limit: int = 100) -> List[Parking]:
        """Get all parking areas"""
        return self.db.query(Parking).offset(skip).limit(limit).all()

    def get_available_parkings(self) -> List[Parking]:
        """Get all available parking areas"""
        return self.db.query(Parking).filter(
            and_(
                Parking.status == ParkingStatus.AVAILABLE,
                Parking.available_spaces > 0
            )
        ).all()

    def update_parking(self, parking_id: int, parking_data: ParkingUpdate) -> Optional[Parking]:
        """Update parking information"""
        db_parking = self.get_parking(parking_id)
        if not db_parking:
            return None
        
        update_data = parking_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_parking, field, value)
        
        self.db.commit()
        self.db.refresh(db_parking)
        return db_parking

    def delete_parking(self, parking_id: int) -> bool:
        """Delete parking area"""
        db_parking = self.get_parking(parking_id)
        if not db_parking:
            return False
        
        self.db.delete(db_parking)
        self.db.commit()
        return True

    # No Parking Zone Management
    def create_no_parking_zone(self, zone_data: NoParkingZoneCreate) -> NoParkingZone:
        """Create a new no parking zone"""
        db_zone = NoParkingZone(**zone_data.dict())
        self.db.add(db_zone)
        self.db.commit()
        self.db.refresh(db_zone)
        return db_zone

    def get_no_parking_zone(self, zone_id: int) -> Optional[NoParkingZone]:
        """Get no parking zone by ID"""
        return self.db.query(NoParkingZone).filter(NoParkingZone.id == zone_id).first()

    def get_no_parking_zones(self, skip: int = 0, limit: int = 1000) -> List[NoParkingZone]:
        """Get all no parking zones"""
        return self.db.query(NoParkingZone).offset(skip).limit(limit).all()

    def get_no_parking_zones_by_type(self, zone_type: str) -> List[NoParkingZone]:
        """Get no parking zones by type"""
        return self.db.query(NoParkingZone).filter(NoParkingZone.zone_type == zone_type).all()

    def get_no_parking_zones_by_reason(self, restriction_reason: str) -> List[NoParkingZone]:
        """Get no parking zones by restriction reason"""
        return self.db.query(NoParkingZone).filter(
            NoParkingZone.restriction_reason == restriction_reason
        ).all()

    def get_strict_no_parking_zones(self) -> List[NoParkingZone]:
        """Get all strict enforcement no parking zones"""
        return self.db.query(NoParkingZone).filter(NoParkingZone.is_strict == True).all()

    def get_no_parking_zones_in_area(
        self, 
        lat_min: float, 
        lat_max: float, 
        lng_min: float, 
        lng_max: float
    ) -> List[NoParkingZone]:
        """Get no parking zones within a specific area"""
        return self.db.query(NoParkingZone).filter(
            and_(
                NoParkingZone.latitude >= lat_min,
                NoParkingZone.latitude <= lat_max,
                NoParkingZone.longitude >= lng_min,
                NoParkingZone.longitude <= lng_max
            )
        ).all()

    def update_no_parking_zone(
        self, 
        zone_id: int, 
        zone_data: NoParkingZoneUpdate
    ) -> Optional[NoParkingZone]:
        """Update no parking zone information"""
        db_zone = self.get_no_parking_zone(zone_id)
        if not db_zone:
            return None
        
        update_data = zone_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_zone, field, value)
        
        self.db.commit()
        self.db.refresh(db_zone)
        return db_zone

    def delete_no_parking_zone(self, zone_id: int) -> bool:
        """Delete no parking zone"""
        db_zone = self.get_no_parking_zone(zone_id)
        if not db_zone:
            return False
        
        self.db.delete(db_zone)
        self.db.commit()
        return True

    def bulk_create_no_parking_zones(self, zones_data: List[Dict[str, Any]]) -> List[NoParkingZone]:
        """Bulk create no parking zones from scraped data"""
        db_zones = []
        for zone_data in zones_data:
            # Convert fine_amount to Decimal if it's a float
            if 'fine_amount' in zone_data and isinstance(zone_data['fine_amount'], float):
                zone_data['fine_amount'] = Decimal(str(zone_data['fine_amount']))
            
            db_zone = NoParkingZone(**zone_data)
            db_zones.append(db_zone)
        
        self.db.add_all(db_zones)
        self.db.commit()
        
        # Refresh all objects
        for db_zone in db_zones:
            self.db.refresh(db_zone)
        
        return db_zones

    # Statistics and Analytics
    def get_parking_statistics(self) -> Dict[str, Any]:
        """Get parking statistics"""
        total_parking = self.db.query(Parking).count()
        available_parking = self.db.query(Parking).filter(
            Parking.status == ParkingStatus.AVAILABLE
        ).count()
        total_spaces = self.db.query(func.sum(Parking.total_spaces)).scalar() or 0
        available_spaces = self.db.query(func.sum(Parking.available_spaces)).scalar() or 0

        return {
            "total_parking_areas": total_parking,
            "available_parking_areas": available_parking,
            "total_parking_spaces": total_spaces,
            "available_parking_spaces": available_spaces,
            "occupancy_rate": round(
                ((total_spaces - available_spaces) / total_spaces * 100) if total_spaces > 0 else 0, 
                2
            )
        }

    def get_no_parking_statistics(self) -> Dict[str, Any]:
        """Get no parking zone statistics"""
        total_zones = self.db.query(NoParkingZone).count()
        strict_zones = self.db.query(NoParkingZone).filter(
            NoParkingZone.is_strict == True
        ).count()
        
        # Count by zone type
        zone_type_counts = self.db.query(
            NoParkingZone.zone_type,
            func.count(NoParkingZone.id)
        ).group_by(NoParkingZone.zone_type).all()
        
        # Count by restriction reason
        reason_counts = self.db.query(
            NoParkingZone.restriction_reason,
            func.count(NoParkingZone.id)
        ).group_by(NoParkingZone.restriction_reason).all()

        return {
            "total_no_parking_zones": total_zones,
            "strict_enforcement_zones": strict_zones,
            "zone_types": dict(zone_type_counts),
            "restriction_reasons": dict(reason_counts),
            "average_fine_amount": float(
                self.db.query(func.avg(NoParkingZone.fine_amount)).scalar() or 0
            )
        }

    def get_combined_parking_overview(self) -> Dict[str, Any]:
        """Get combined overview of parking and no parking zones"""
        parking_stats = self.get_parking_statistics()
        no_parking_stats = self.get_no_parking_statistics()
        
        return {
            "parking_areas": parking_stats,
            "no_parking_zones": no_parking_stats,
            "generated_at": datetime.now().isoformat()
        }

    # Import functionality
    def import_no_parking_zones_from_json(self, json_file_path: str) -> Dict[str, Any]:
        """Import no parking zones from JSON file"""
        try:
            with open(json_file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            zones_data = data.get('zones', [])
            if not zones_data:
                return {"success": False, "message": "No zones found in JSON file"}
            
            # Clear existing zones first (optional - you might want to keep existing ones)
            # self.db.query(NoParkingZone).delete()
            
            # Create zones
            created_zones = self.bulk_create_no_parking_zones(zones_data)
            
            return {
                "success": True,
                "message": f"Successfully imported {len(created_zones)} no parking zones",
                "total_imported": len(created_zones),
                "metadata": {
                    "city": data.get('city'),
                    "total_zones": data.get('total_zones'),
                    "scrape_timestamp": data.get('scrape_timestamp'),
                    "statistics": data.get('statistics', {})
                }
            }
        
        except Exception as e:
            return {
                "success": False,
                "message": f"Error importing zones: {str(e)}"
            }
