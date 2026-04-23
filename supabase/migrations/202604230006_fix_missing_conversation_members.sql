-- Fix existing direct conversations that are missing the other user as a member
-- This adds all organization users as members to their direct conversations
-- This is a simpler approach that doesn't rely on parsing the title

DO $$
DECLARE
    conv_record RECORD;
    org_user_record RECORD;
    member_exists BOOLEAN;
BEGIN
    -- For each direct conversation
    FOR conv_record IN 
        SELECT id, organization_id, created_by 
        FROM chat_conversations 
        WHERE type = 'direct'
    LOOP
        -- Add all users in the same organization as members
        FOR org_user_record IN 
            SELECT id FROM profiles 
            WHERE organization_id = conv_record.organization_id 
            AND id != conv_record.created_by
        LOOP
            -- Check if the user is already a member
            SELECT EXISTS(
                SELECT 1 FROM chat_conversation_members 
                WHERE conversation_id = conv_record.id 
                AND user_id = org_user_record.id
            ) INTO member_exists;
            
            -- If not, add them as a member
            IF NOT member_exists THEN
                INSERT INTO chat_conversation_members (conversation_id, user_id, role)
                VALUES (conv_record.id, org_user_record.id, 'member');
                
                RAISE NOTICE 'Added user % as member to conversation %', org_user_record.id, conv_record.id;
            END IF;
        END LOOP;
    END LOOP;
END $$;
