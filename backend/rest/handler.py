"""
VoteSphere — REST API Lambda handler
Routes (API Gateway HTTP API):
  POST   /polls
  GET    /polls
  GET    /polls/{poll_id}
  POST   /polls/{poll_id}/vote
  POST   /polls/{poll_id}/close
  GET    /stats
Environment variables:
  POLLS_TABLE        (default: VoteSpherePolls)
  VOTES_TABLE        (default: VoteSphereVotes)
  CONNECTIONS_TABLE  (default: VoteSphereConnections)
  WS_ENDPOINT        e.g. https://xxxxx.execute-api.us-east-1.amazonaws.com/prod
"""

import os
import json
import uuid
import time
from decimal import Decimal
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

REGION = os.environ.get("AWS_REGION", "us-east-1")
POLLS_TABLE = os.environ.get("POLLS_TABLE", "VoteSpherePolls")
VOTES_TABLE = os.environ.get("VOTES_TABLE", "VoteSphereVotes")
CONNECTIONS_TABLE = os.environ.get("CONNECTIONS_TABLE", "VoteSphereConnections")
WS_ENDPOINT = os.environ.get("WS_ENDPOINT", "")

dynamodb = boto3.resource("dynamodb", region_name=REGION)
polls_tbl = dynamodb.Table(POLLS_TABLE)
votes_tbl = dynamodb.Table(VOTES_TABLE)
conn_tbl = dynamodb.Table(CONNECTIONS_TABLE)

_apigw = None
def apigw():
    global _apigw
    if _apigw is None and WS_ENDPOINT:
        _apigw = boto3.client(
            "apigatewaymanagementapi",
            endpoint_url=WS_ENDPOINT,
            region_name=REGION,
        )
    return _apigw


def _resp(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        },
        "body": json.dumps(body, default=_json_default),
    }


def _json_default(o):
    if isinstance(o, Decimal):
        return int(o) if o % 1 == 0 else float(o)
    return str(o)


def _now():
    return datetime.now(timezone.utc).isoformat()


def lambda_handler(event, context):
    method = (event.get("requestContext", {}).get("http", {}) or {}).get("method") \
             or event.get("httpMethod", "GET")
    path = event.get("rawPath") or event.get("path", "/")
    path_params = event.get("pathParameters") or {}
    query = event.get("queryStringParameters") or {}

    if method == "OPTIONS":
        return _resp(200, {"ok": True})

    try:
        # POST /polls
        if method == "POST" and path.rstrip("/").endswith("/polls"):
            return _create_poll(event)

        # GET /polls
        if method == "GET" and path.rstrip("/").endswith("/polls"):
            return _list_polls(query)

        # GET /polls/{id}
        if method == "GET" and "poll_id" in path_params:
            return _get_poll(path_params["poll_id"])

        # POST /polls/{id}/vote
        if method == "POST" and "poll_id" in path_params and path.endswith("/vote"):
            return _vote(path_params["poll_id"], event)

        # POST /polls/{id}/close
        if method == "POST" and "poll_id" in path_params and path.endswith("/close"):
            return _close(path_params["poll_id"])

        # GET /stats
        if method == "GET" and path.rstrip("/").endswith("/stats"):
            return _stats()

        return _resp(404, {"error": "Route not found"})
    except ClientError as e:
        return _resp(500, {"error": str(e)})
    except Exception as e:
        return _resp(500, {"error": str(e)})


def _body(event):
    raw = event.get("body") or "{}"
    try:
        return json.loads(raw)
    except Exception:
        return {}


def _create_poll(event):
    data = _body(event)
    question = (data.get("question") or "").strip()
    options = data.get("options") or []
    closing_time = data.get("closing_time")

    if not question or len(question) > 200:
        return _resp(400, {"error": "Question is required (max 200 chars)."})
    if not isinstance(options, list) or len(options) < 2 or len(options) > 10:
        return _resp(400, {"error": "Provide 2–10 options."})

    cleaned = [str(o).strip() for o in options if str(o).strip()]
    if len(cleaned) < 2:
        return _resp(400, {"error": "At least 2 non-empty options required."})
    if len({o.lower() for o in cleaned}) != len(cleaned):
        return _resp(400, {"error": "Options must be unique."})

    poll_id = uuid.uuid4().hex[:12]
    created_at = _now()

    option_items = [
        {"option_id": uuid.uuid4().hex[:8], "text": txt, "votes": 0}
        for txt in cleaned
    ]

    item = {
        "poll_id": poll_id,
        "question": question,
        "options": option_items,
        "total_votes": 0,
        "status": "active",
        "created_at": created_at,
    }
    if closing_time:
        item["closing_time"] = closing_time

    polls_tbl.put_item(Item=item)
    return _resp(201, item)


def _list_polls(query):
    status = (query.get("status") or "all").lower()
    q = (query.get("q") or "").lower()

    result = polls_tbl.scan()
    items = result.get("Items", [])

    if status in ("active", "closed"):
        items = [i for i in items if i.get("status") == status]
    if q:
        items = [i for i in items if q in (i.get("question") or "").lower()]

    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return _resp(200, {"polls": items})


def _get_poll(poll_id):
    res = polls_tbl.get_item(Key={"poll_id": poll_id})
    item = res.get("Item")
    if not item:
        return _resp(404, {"error": "Poll not found"})

    # Auto-close if past closing_time
    ct = item.get("closing_time")
    if item.get("status") == "active" and ct:
        try:
            if datetime.fromisoformat(ct.replace("Z", "+00:00")) < datetime.now(timezone.utc):
                polls_tbl.update_item(
                    Key={"poll_id": poll_id},
                    UpdateExpression="SET #s = :s",
                    ExpressionAttributeNames={"#s": "status"},
                    ExpressionAttributeValues={":s": "closed"},
                )
                item["status"] = "closed"
        except Exception:
            pass

    return _resp(200, item)


def _vote(poll_id, event):
    data = _body(event)
    option_id = (data.get("option_id") or "").strip()
    voter_id = (data.get("voter_id") or "").strip()

    if not option_id or not voter_id:
        return _resp(400, {"error": "option_id and voter_id are required."})

    poll_res = polls_tbl.get_item(Key={"poll_id": poll_id})
    poll = poll_res.get("Item")
    if not poll:
        return _resp(404, {"error": "Poll not found"})
    if poll.get("status") != "active":
        return _resp(409, {"error": "Poll is closed."})

    # Check closing_time
    ct = poll.get("closing_time")
    if ct:
        try:
            if datetime.fromisoformat(ct.replace("Z", "+00:00")) < datetime.now(timezone.utc):
                return _resp(409, {"error": "Poll is closed."})
        except Exception:
            pass

    valid_options = {o["option_id"] for o in poll.get("options", [])}
    if option_id not in valid_options:
        return _resp(400, {"error": "Invalid option."})

    # Idempotent vote: conditional put on (poll_id, voter_id)
    try:
        votes_tbl.put_item(
            Item={
                "poll_id": poll_id,
                "voter_id": voter_id,
                "option_id": option_id,
                "created_at": _now(),
            },
            ConditionExpression="attribute_not_exists(poll_id) AND attribute_not_exists(voter_id)",
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return _resp(409, {"error": "You have already voted on this poll."})
        raise

    # Increment option vote count + total_votes
    polls_tbl.update_item(
        Key={"poll_id": poll_id},
        UpdateExpression=(
            "SET #opts = :opts ADD total_votes :one"
        ),
        ExpressionAttributeNames={"#opts": "options"},
        ExpressionAttributeValues={
            ":opts": [
                {**o, "votes": (o.get("votes", 0) + 1) if o["option_id"] == option_id else o.get("votes", 0)}
                for o in poll.get("options", [])
            ],
            ":one": 1,
        },
    )

    updated = polls_tbl.get_item(Key={"poll_id": poll_id}).get("Item", {})

    # Broadcast to subscribers
    _broadcast(updated)

    return _resp(200, updated)


def _close(poll_id):
    try:
        polls_tbl.update_item(
            Key={"poll_id": poll_id},
            UpdateExpression="SET #s = :s",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":s": "closed"},
        )
    except ClientError as e:
        return _resp(500, {"error": str(e)})
    return _resp(200, {"poll_id": poll_id, "status": "closed"})


def _stats():
    total_polls = 0
    total_votes = 0
    active_polls = 0
    total_options = 0
    scan_kwargs = {}
    while True:
        res = polls_tbl.scan(**scan_kwargs)
        for it in res.get("Items", []):
            total_polls += 1
            total_votes += int(it.get("total_votes", 0))
            total_options += len(it.get("options", []))
            if it.get("status") == "active":
                active_polls += 1
        if "LastEvaluatedKey" in res:
            scan_kwargs["ExclusiveStartKey"] = res["LastEvaluatedKey"]
        else:
            break

    return _resp(200, {
        "total_polls": total_polls,
        "total_votes": total_votes,
        "active_polls": active_polls,
        "total_options": total_options,
    })


def _broadcast(poll):
    """Send updated results to all subscribers of the poll."""
    client = apigw()
    if not client:
        return

    # Fetch subscribers
    try:
        subs = conn_tbl.query(
            IndexName="poll_id-index",
            KeyConditionExpression="poll_id = :p",
            ExpressionAttributeValues={":p": poll["poll_id"]},
        ).get("Items", [])
    except ClientError:
        # Index may not exist; fall back to scan
        subs = [
            i for i in conn_tbl.scan().get("Items", [])
            if i.get("poll_id") == poll["poll_id"]
        ]

    payload = json.dumps({
        "type": "results",
        "poll_id": poll["poll_id"],
        "options": poll.get("options", []),
        "total_votes": int(poll.get("total_votes", 0)),
        "status": poll.get("status", "active"),
    }, default=_json_default).encode("utf-8")

    for s in subs:
        cid = s.get("connection_id")
        if not cid:
            continue
        try:
            client.post_to_connection(ConnectionId=cid, Data=payload)
        except client.exceptions.GoneException:
            try: conn_tbl.delete_item(Key={"connection_id": cid})
            except Exception: pass
        except Exception:
            pass