import { byteDecoder } from './../iden3comm/utils/index';
import { MediaType } from './../iden3comm/constants';
import { CircuitId } from '../circuits/models';
import { IProofService } from '../proof/proof-service';
import { PROTOCOL_MESSAGE_TYPE } from '../iden3comm/constants';

import {
  AuthorizationRequestMessage,
  AuthorizationRequestMessageBody,
  AuthorizationResponseMessage,
  IPackageManager,
  ZeroKnowledgeProofRequest,
  ZeroKnowledgeProofResponse
} from '../iden3comm';
import { DID } from '@iden3/js-iden3-core';
import { proving } from '@iden3/js-jwz';

import * as uuid from 'uuid';

/**
 * Interface that allows the processing of the authorization request in the raw format for given identifier
 *
 * @export
 * @beta
 * @interface   IAuthHandler
 */
export interface IAuthHandler {
  handleAuthorizationRequest(
    id: DID,
    request: Uint8Array
  ): Promise<{
    token: string;
    authRequest: AuthorizationRequestMessage;
    authResponse: AuthorizationResponseMessage;
  }>;
}
/**
 *
 * Allows to process AuthorizationRequest protocol message and produce JWZ response.
 *
 * @export
 * @beta

 * @class AuthHandler
 * @implements implements IAuthHandler interface
 */
export class AuthHandler implements IAuthHandler {
  /**
   * Creates an instance of AuthHandler.
   * @param {IPackageManager} _packerMgr - package manager to unpack message envelope
   * @param {IProofService} _proofService -  proof service to verify zk proofs
   */
  constructor(
    private readonly _packerMgr: IPackageManager,
    private readonly _proofService: IProofService
  ) {}

  /**
   * Handles only messages with <i>authorization/v1.0/request</i> type
   * Generates all requested proofs and wraps authorization response message to JWZ token
   * @param {DID} did - an identity that will process the request
   * @param {Uint8Array} request - raw request
   * @returns `Promise<{token: string; authRequest: AuthorizationRequestMessage; authResponse: AuthorizationResponseMessage;}>` JWZ token, parsed request and response
   */
  async handleAuthorizationRequest(
    did: DID,
    request: Uint8Array
  ): Promise<{
    token: string;
    authRequest: AuthorizationRequestMessage;
    authResponse: AuthorizationResponseMessage;
  }> {
    const { unpackedMessage: message } = await this._packerMgr.unpack(request);
    const authRequest = message as unknown as AuthorizationRequestMessage;
    if (message.type !== PROTOCOL_MESSAGE_TYPE.AUTHORIZATION_REQUEST_MESSAGE_TYPE) {
      throw new Error('Invalid media type');
    }
    const authRequestBody = message.body as unknown as AuthorizationRequestMessageBody;

    const guid = uuid.v4();
    const authResponse: AuthorizationResponseMessage = {
      id: guid,
      typ: MediaType.ZKPMessage,
      type: PROTOCOL_MESSAGE_TYPE.AUTHORIZATION_RESPONSE_MESSAGE_TYPE,
      thid: message.thid ?? guid,
      body: {
        did_doc: undefined, //  slipped for now, todo: get did doc for id
        message: authRequestBody.message,
        scope: []
      },
      from: did.toString(),
      to: message.from
    };
    for (const proofReq of authRequestBody.scope) {
      const zkpReq: ZeroKnowledgeProofRequest = {
        id: proofReq.id,
        circuitId: proofReq.circuitId as CircuitId,
        query: proofReq.query
      };

      const { proof } = await this._proofService.generateProof(zkpReq, did);

      const zkpRes: ZeroKnowledgeProofResponse = {
        id: zkpReq.id,
        circuitId: zkpReq.circuitId,
        proof: proof.proof,
        pub_signals: proof.pub_signals
      };

      authResponse.body.scope.push(zkpRes);
    }
    const msgBytes = new TextEncoder().encode(JSON.stringify(authResponse));
    const token = byteDecoder.decode(
      await this._packerMgr.pack(MediaType.ZKPMessage, msgBytes, {
        senderID: did,
        provingMethodAlg: proving.provingMethodGroth16AuthV2Instance.methodAlg
      })
    );
    return { authRequest, authResponse, token };
  }
}
