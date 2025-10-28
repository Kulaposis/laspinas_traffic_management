"""
Service for generating real-time traffic insights and daily traffic analysis.
Provides intelligent traffic condition summaries and recommendations.
"""

import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from ..models.traffic import TrafficMonitoring, TrafficStatus, RoadIncident
from ..models.weather import WeatherData, WeatherAlert


class TrafficInsightsService:
    def __init__(self):
        self.insights_cache = {}
        self.cache_duration = 300  # 5 minutes cache
        
    def get_daily_traffic_insights(self, db: Session) -> Dict:
        """Generate daily traffic insights with personalized messages."""
        try:
            current_time = datetime.now()
            cache_key = f"daily_insights_{current_time.strftime('%Y-%m-%d-%H')}"
            
            # Check cache
            if cache_key in self.insights_cache:
                cached_time, cached_data = self.insights_cache[cache_key]
                if (current_time - cached_time).seconds < self.cache_duration:
                    return cached_data
            
            # Get current traffic data with error handling
            try:
                traffic_data = db.query(TrafficMonitoring).all()
                active_incidents = db.query(RoadIncident).filter(RoadIncident.is_active == True).all()
            except Exception as e:
                print(f"Database query error: {e}")
                return self._get_default_insights()
            
            # Calculate traffic metrics
            total_roads = len(traffic_data)
            if total_roads == 0:
                return self._get_default_insights()
            
            free_flow_count = len([t for t in traffic_data if t.traffic_status == TrafficStatus.FREE_FLOW])
            light_traffic_count = len([t for t in traffic_data if t.traffic_status == TrafficStatus.LIGHT])
            moderate_traffic_count = len([t for t in traffic_data if t.traffic_status == TrafficStatus.MODERATE])
            heavy_traffic_count = len([t for t in traffic_data if t.traffic_status == TrafficStatus.HEAVY])
            standstill_count = len([t for t in traffic_data if t.traffic_status == TrafficStatus.STANDSTILL])
            
            # Calculate overall traffic score (0-100, where 100 is best)
            traffic_score = (
                (free_flow_count * 100) +
                (light_traffic_count * 80) +
                (moderate_traffic_count * 60) +
                (heavy_traffic_count * 30) +
                (standstill_count * 0)
            ) / total_roads
            
            # Generate insights based on current conditions
            insights = self._generate_insights(
                traffic_score, current_time, total_roads, free_flow_count, 
                heavy_traffic_count + standstill_count, len(active_incidents)
            )
            
            # Cache the results
            self.insights_cache[cache_key] = (current_time, insights)
            
            return insights
        except Exception as e:
            print(f"Error in get_daily_traffic_insights: {e}")
            return self._get_default_insights()
    
    def _generate_insights(self, traffic_score: float, current_time: datetime, 
                          total_roads: int, free_flow_count: int, 
                          congested_count: int, incident_count: int) -> Dict:
        """Generate personalized traffic insights based on current conditions."""
        
        # Determine overall condition
        if traffic_score >= 85:
            condition = "excellent"
            condition_emoji = "🟢"
            condition_message = "Traffic is flowing smoothly throughout Las Piñas!"
        elif traffic_score >= 70:
            condition = "good"
            condition_emoji = "🟡"
            condition_message = "Traffic conditions are generally good with minor delays."
        elif traffic_score >= 50:
            condition = "moderate"
            condition_emoji = "🟠"
            condition_message = "Expect moderate traffic with some congestion in key areas."
        elif traffic_score >= 30:
            condition = "heavy"
            condition_emoji = "🔴"
            condition_message = "Heavy traffic detected. Consider alternative routes."
        else:
            condition = "severe"
            condition_emoji = "🚨"
            condition_message = "Severe traffic congestion. Significant delays expected."
        
        # Time-based recommendations
        hour = current_time.hour
        time_recommendations = self._get_time_based_recommendations(hour, condition)
        
        # Generate main insight message
        main_message = self._generate_main_message(condition, current_time, incident_count)
        
        # Generate route recommendations
        route_recommendations = self._generate_route_recommendations(condition, hour, incident_count)
        
        # Calculate estimated impact
        congestion_percentage = (congested_count / total_roads) * 100
        
        return {
            "timestamp": current_time.isoformat(),
            "overall_condition": condition,
            "traffic_score": round(traffic_score, 1),
            "condition_emoji": condition_emoji,
            "main_message": main_message,
            "condition_message": condition_message,
            "recommendations": time_recommendations,
            "route_suggestions": route_recommendations,
            "statistics": {
                "total_monitored_roads": total_roads,
                "free_flowing_roads": free_flow_count,
                "congested_roads": congested_count,
                "active_incidents": incident_count,
                "congestion_percentage": round(congestion_percentage, 1)
            },
            "next_update": (current_time + timedelta(minutes=15)).isoformat(),
            "advisory": self._generate_advisory(condition, hour, incident_count)
        }
    
    def _generate_main_message(self, condition: str, current_time: datetime, incident_count: int) -> str:
        """Generate a personalized main insight message."""
        hour = current_time.hour
        day_name = current_time.strftime("%A")
        
        # Time of day context
        if 6 <= hour <= 9:
            time_context = "this morning"
        elif 12 <= hour <= 14:
            time_context = "this afternoon"
        elif 17 <= hour <= 19:
            time_context = "this evening"
        elif 20 <= hour <= 23:
            time_context = "tonight"
        else:
            time_context = "right now"
        
        # Base messages by condition
        messages = {
            "excellent": [
                f"Great news! Traffic is excellent {time_context}. Perfect time to hit the road! 🚗✨",
                f"Traffic conditions are ideal {time_context}. Smooth sailing ahead! 🌟",
                f"Fantastic! {day_name} traffic is flowing beautifully {time_context}. Enjoy your drive! 🎯"
            ],
            "good": [
                f"Good news! Traffic is moving well {time_context}. Minor delays only. 👍",
                f"Traffic conditions are favorable {time_context}. You should have a smooth trip! 🛣️",
                f"Looking good! {day_name} traffic is manageable {time_context}. Safe travels! 🚦"
            ],
            "moderate": [
                f"Heads up! Moderate traffic {time_context}. Plan for some extra time. ⏰",
                f"Traffic is picking up {time_context}. Consider your route options. 🤔",
                f"{day_name} traffic is moderate {time_context}. Allow extra travel time. 📍"
            ],
            "heavy": [
                f"Traffic alert! Heavy congestion {time_context}. Alternative routes recommended. 🚧",
                f"Busy roads {time_context}! Consider delaying your trip or taking alternate routes. 🔄",
                f"{day_name} brings heavy traffic {time_context}. Smart routing suggested! 🧭"
            ],
            "severe": [
                f"Traffic warning! Severe congestion {time_context}. Avoid non-essential travel. ⚠️",
                f"Major delays expected {time_context}! Consider postponing or finding alternatives. 🚨",
                f"Critical traffic situation {time_context}. Plan accordingly! 🆘"
            ]
        }
        
        # Add incident context
        base_message = random.choice(messages[condition])
        if incident_count > 0:
            if incident_count == 1:
                base_message += f" Note: 1 active incident affecting traffic."
            else:
                base_message += f" Note: {incident_count} active incidents affecting traffic."
        
        return base_message
    
    def _get_time_based_recommendations(self, hour: int, condition: str) -> List[str]:
        """Generate time-based traffic recommendations."""
        recommendations = []
        
        # Rush hour recommendations
        if 7 <= hour <= 9:  # Morning rush
            if condition in ["heavy", "severe"]:
                recommendations.extend([
                    "🌅 Morning rush hour - Consider leaving earlier or later",
                    "🚌 Public transportation might be faster during peak hours",
                    "☕ Grab coffee and wait 30 minutes for traffic to ease"
                ])
            else:
                recommendations.append("🌅 Morning traffic is lighter than usual - good time to travel!")
                
        elif 17 <= hour <= 19:  # Evening rush
            if condition in ["heavy", "severe"]:
                recommendations.extend([
                    "🌆 Evening rush hour - Expect significant delays",
                    "🏢 Consider working late to avoid peak traffic",
                    "🍽️ Perfect time for dinner - let traffic clear first"
                ])
            else:
                recommendations.append("🌆 Evening traffic is manageable - good time to head home!")
                
        elif 12 <= hour <= 13:  # Lunch hour
            recommendations.append("🍽️ Lunch hour traffic - Quick trips recommended")
            
        elif 22 <= hour or hour <= 5:  # Late night/early morning
            recommendations.append("🌙 Night time - Roads are clear, drive safely!")
            
        else:  # Regular hours
            if condition == "excellent":
                recommendations.append("✨ Off-peak hours - Perfect time for errands!")
            
        # Weather-based recommendations (you can expand this with actual weather data)
        if hour >= 6 and hour <= 18:
            recommendations.append("☀️ Daylight hours - Good visibility for driving")
        
        # Condition-specific recommendations
        if condition in ["heavy", "severe"]:
            recommendations.extend([
                "🎧 Perfect time to catch up on podcasts or music",
                "📱 Inform others about potential delays",
                "⛽ Ensure you have enough fuel for longer travel times"
            ])
        
        return recommendations[:4]  # Limit to top 4 recommendations
    
    def _generate_route_recommendations(self, condition: str, hour: int, incident_count: int) -> List[Dict]:
        """Generate smart route recommendations based on current conditions."""
        recommendations = []
        
        # Major Las Piñas routes with alternatives
        routes = [
            {
                "main_route": "Alabang-Zapote Road",
                "alternative": "CAA Road via Almanza",
                "reason": "Less congested during peak hours",
                "time_savings": "5-10 minutes"
            },
            {
                "main_route": "Westservice Road",
                "alternative": "C-5 Extension via Real Street",
                "reason": "Bypass heavy traffic areas",
                "time_savings": "8-15 minutes"
            },
            {
                "main_route": "Almanza Road",
                "alternative": "Niog Road via Talon",
                "reason": "Avoid construction zones",
                "time_savings": "3-7 minutes"
            }
        ]
        
        if condition in ["heavy", "severe"] or incident_count > 0:
            # Prioritize alternative routes during heavy traffic
            for route in routes[:2]:  # Show top 2 alternatives
                recommendations.append({
                    "type": "alternative_route",
                    "title": f"Avoid {route['main_route']}",
                    "suggestion": f"Take {route['alternative']} instead",
                    "reason": route['reason'],
                    "estimated_savings": route['time_savings'],
                    "confidence": "high" if condition == "severe" else "medium"
                })
        
        # Time-based route suggestions
        if 7 <= hour <= 9 or 17 <= hour <= 19:  # Rush hours
            recommendations.append({
                "type": "timing",
                "title": "Peak Hour Strategy",
                "suggestion": "Consider staggered departure times",
                "reason": "Traffic typically reduces by 30% after peak hours",
                "estimated_savings": "15-25 minutes",
                "confidence": "high"
            })
        
        # General smart routing tip
        if condition != "excellent":
            recommendations.append({
                "type": "smart_routing",
                "title": "Use Smart Navigation",
                "suggestion": "Enable real-time traffic updates in your GPS app",
                "reason": "Get live rerouting around incidents and congestion",
                "estimated_savings": "Variable",
                "confidence": "high"
            })
        
        return recommendations[:3]  # Limit to top 3 recommendations
    
    def _generate_advisory(self, condition: str, hour: int, incident_count: int) -> Dict:
        """Generate traffic advisory information."""
        advisory_level = "normal"
        advisory_message = "No special advisories at this time."
        
        if condition == "severe" or incident_count >= 3:
            advisory_level = "critical"
            advisory_message = "Critical traffic conditions. Avoid non-essential travel."
        elif condition == "heavy" or incident_count >= 2:
            advisory_level = "high"
            advisory_message = "Heavy traffic conditions. Allow extra travel time."
        elif condition == "moderate" or incident_count >= 1:
            advisory_level = "medium"
            advisory_message = "Moderate traffic conditions. Plan your route accordingly."
        
        return {
            "level": advisory_level,
            "message": advisory_message,
            "color": {
                "normal": "#22c55e",
                "medium": "#eab308", 
                "high": "#f97316",
                "critical": "#ef4444"
            }.get(advisory_level, "#6b7280")
        }
    
    def _get_default_insights(self) -> Dict:
        """Return default insights when no traffic data is available."""
        current_time = datetime.now()
        return {
            "timestamp": current_time.isoformat(),
            "overall_condition": "unknown",
            "traffic_score": 0,
            "condition_emoji": "❓",
            "main_message": "Traffic monitoring system is initializing. Please check back shortly.",
            "condition_message": "No traffic data available at the moment.",
            "recommendations": [
                "📡 Traffic monitoring system is starting up",
                "🔄 Data will be available shortly",
                "📱 Check back in a few minutes"
            ],
            "route_suggestions": [],
            "statistics": {
                "total_monitored_roads": 0,
                "free_flowing_roads": 0,
                "congested_roads": 0,
                "active_incidents": 0,
                "congestion_percentage": 0
            },
            "next_update": (current_time + timedelta(minutes=5)).isoformat(),
            "advisory": {
                "level": "normal",
                "message": "System initializing. No advisories at this time.",
                "color": "#6b7280"
            }
        }
    
    def get_hourly_traffic_trends(self, db: Session) -> Dict:
        """Get traffic trends for the current day by hour."""
        current_date = datetime.now().date()
        
        # This is a simplified version - in production you'd query historical data
        trends = {
            "date": current_date.isoformat(),
            "hourly_scores": {},
            "peak_hours": [],
            "best_travel_times": []
        }
        
        # Generate sample hourly trends based on typical patterns
        for hour in range(24):
            if 7 <= hour <= 9 or 17 <= hour <= 19:  # Rush hours
                score = random.randint(30, 50)
            elif 12 <= hour <= 13:  # Lunch hour
                score = random.randint(60, 75)
            elif 22 <= hour or hour <= 5:  # Late night
                score = random.randint(85, 95)
            else:  # Regular hours
                score = random.randint(70, 85)
            
            trends["hourly_scores"][hour] = score
        
        # Identify peak hours (lowest scores)
        sorted_hours = sorted(trends["hourly_scores"].items(), key=lambda x: x[1])
        trends["peak_hours"] = [hour for hour, score in sorted_hours[:4]]
        
        # Identify best travel times (highest scores)
        trends["best_travel_times"] = [hour for hour, score in sorted_hours[-4:]]
        
        return trends

# Global instance
traffic_insights_service = TrafficInsightsService()
