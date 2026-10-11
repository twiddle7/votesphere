"""
VoteSphere — WebSocket Lambda handler
Routes:
  $connect      -> store connection
  $disconnect   -> remove connection
  subscribe     -> attach connection to a poll_id
Environment variables:
  CONNECTIONS_TABLE  (default: VoteSphereConnections)
"""

import os
import json
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

REGION = os.environ.get("AWS_REGION", "us-east-1")
CONNECTIONS_TABLE = os.environ.get("CONNECTIONS_TABLE", "VoteSphereConnections")

dynamodb = boto3.resource("dynamodb", region_name=REGION)
conn_tbl = dynamodb.Table(CONNECTIONS_TABLE)


def _now():
    return datetime.now(timezone.utc).isoformat()


def lambda_handler(event, context):
    ctx = event.get("requestContext", {})
    route = ctx.get("routeKey", "")
    connection_id = ctx.get("connectionId")

    try:
        if route == "$connect":
            conn_tbl.put_item(Item={
                "connection_id": connection_id,
                "connected_at": _now(),
            })
            return {"statusCode": 200}

        if route == "$disconnect":
            conn_tbl.delete_item(Key={"connection_id": connection_id})
            return {"statusCode": 200}

        if route == "subscribe":
            body = event.get("body") or "{}"
            try:
                data = json.loads(body)
            except Exception:
                data = {}
            poll_id = data.get("poll_id")
            if not poll_id:
                return {"statusCode": 400, "body": "poll_id required"}

            conn_tbl.update_item(
                Key={"connection_id": connection_id},
                UpdateExpression="SET poll_id = :p",
                ExpressionAttributeValues={":p": poll_id},
            )
            return {"statusCode": 200, "body": "subscribed"}

        return {"statusCode": 400, "body": "Unknown route"}
    except ClientError as e:
        return {"statusCode": 500, "body": str(e)}