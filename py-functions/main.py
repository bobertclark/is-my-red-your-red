import logging

from firebase_functions.firestore_fn import on_document_created, Event
from firebase_admin import initialize_app, firestore
import google.cloud.logging

# Create a logger instance
logger = logging.getLogger("updateHueBucket")
firebase_initialized = False
gcloud_logging_initialized = False

def initialize_services():
    global firebase_initialized, gcloud_logging_initialized
    if not firebase_initialized:
        try:
            initialize_app()
            firebase_initialized = True
            logger.info("Firebase Admin SDK initialized successfully.")
        except Exception as e:
            logger.exception("Failed to initialize Firebase Admin SDK: %s", e)
    if not gcloud_logging_initialized:
        try:
            client = google.cloud.logging.Client()
            client.setup_logging()
            gcloud_logging_initialized = True
            logger.info("Google Cloud Logging initialized successfully.")
        except Exception as e:
            logger.exception("Failed to initialize Google Cloud Logging: %s", e)


@on_document_created(document="/results/{userId}/userResults/{docId}")
def updateHueBucket(event: Event[firestore.DocumentSnapshot]) -> None:
    """
    Triggered when a new document is created in the 'userResults' subcollection.
    Updates the bucket-counts collection based on the threshold_hue value.
    """
    try:
        initialize_services()
        logger.info("Function updateHueBucket triggered.")
        
        # Get the newly created document's data
        new_doc_data = event.data.to_dict()
        hue = new_doc_data.get("threshold_hue")  # Assuming the document contains a 'threshold_hue' field

        if not isinstance(hue, (int, float)):
            logger.error(f"Invalid hue value: {hue}")
            return

        # Reference the bucket-counts collection
        db = firestore.client()
        bucket_doc_ref = db.collection("bucket-counts").document(str(hue))

        # Run a transaction to update the bucket count
        @firestore.transactional
        def update_transaction(transaction, bucket_ref):
            bucket_doc = bucket_ref.get(transaction=transaction)

            if bucket_doc.exists:
                logger.info("Document exists, incrementing count")
                current_count = bucket_doc.to_dict().get("count", 0)
                transaction.update(bucket_ref, {"count": current_count + 1})
            else:
                logger.info("Document does not exist, creating new bucket")
                transaction.set(bucket_ref, {"count": 1})

        transaction = db.transaction()
        update_transaction(transaction, bucket_doc_ref)
        logger.info(f"Bucket for hue {hue} updated successfully.")

    except Exception as error:
        logger.exception(f"Error updating hue bucket: {error}")